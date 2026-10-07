const jwt = require('jsonwebtoken');
const env = require('../config/env');
const db = require('../config/db');

const ALCANCE_COMPLETO = 'COMPLETO';
const ALCANCE_CAMBIO_PASSWORD = 'CAMBIO_PASSWORD';

function rechazar(res, status, message, codigo) {
  return res.status(status).json({ status: 'ERROR', message, ...(codigo ? { codigo } : {}) });
}

function leerToken(req) {
  const header = req.headers.authorization;
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) return null;
  return header.slice(7).trim() || null;
}

/**
 * Verifica el JWT y el estado actual de la cuenta en la base de datos:
 * - la cuenta y la persona deben seguir activas,
 * - el token debe ser posterior al último cambio de contraseña (revocación),
 * - el rol se toma de la base, así un cambio de rol aplica de inmediato.
 */
function crearVerificador({ permitirCambioPassword }) {
  return async (req, res, next) => {
    const token = leerToken(req);
    if (!token) return rechazar(res, 401, 'Acceso no autorizado. Inicie sesión.');

    let payload;
    try {
      payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
    } catch {
      return rechazar(res, 401, 'La sesión expiró o no es válida. Inicie sesión nuevamente.');
    }

    const [rows] = await db.query(
      `SELECT c.id, c.estado, c.password_updated_at, c.debe_cambiar_password, p.id AS persona_id, p.estado AS persona_estado,
              p.cedula, p.nombres, p.apellidos, r.codigo AS rol
       FROM cuentas c
       JOIN personas p ON p.id = c.persona_id
       JOIN roles r ON r.id = c.rol_id
       WHERE c.id = ?`,
      [payload.cuentaId]
    );
    const cuenta = rows[0];
    if (!cuenta || cuenta.estado !== 'ACTIVA' || cuenta.persona_estado !== 'ACTIVO') {
      return rechazar(res, 401, 'La cuenta no está habilitada.');
    }

    if (cuenta.password_updated_at) {
      const emitido = Number(payload.ts) || payload.iat * 1000;
      if (emitido < new Date(cuenta.password_updated_at).getTime()) {
        return rechazar(res, 401, 'La contraseña cambió. Inicie sesión nuevamente.');
      }
    }

    const alcance = payload.alcance || ALCANCE_COMPLETO;
    if (alcance === ALCANCE_CAMBIO_PASSWORD && !permitirCambioPassword) {
      return rechazar(res, 403, 'Debe cambiar su contraseña temporal antes de continuar.', 'CAMBIO_PASSWORD_REQUERIDO');
    }

    req.user = {
      cuentaId: cuenta.id,
      personaId: cuenta.persona_id,
      cedula: cuenta.cedula,
      nombres: cuenta.nombres,
      apellidos: cuenta.apellidos,
      rol: cuenta.rol,
      alcance
    };
    next();
  };
}

/** Exige un token de sesión completo. */
const verificarToken = crearVerificador({ permitirCambioPassword: false });

/** Si llega un token lo valida; si no hay token deja pasar la petición sin usuario. */
function autenticacionOpcional(req, res, next) {
  if (!leerToken(req)) return next();
  return verificarToken(req, res, next);
}

/** Acepta también el token temporal emitido para cambiar la contraseña. */
const verificarTokenOCambioPassword = crearVerificador({ permitirCambioPassword: true });

/**
 * Exige que el usuario autenticado tenga uno de los roles indicados.
 * @param {string[]} rolesPermitidos
 */
function verificarRol(rolesPermitidos) {
  return (req, res, next) => {
    if (!req.user) return rechazar(res, 401, 'Acceso no autorizado. Inicie sesión.');
    if (!rolesPermitidos.includes(req.user.rol)) {
      return rechazar(res, 403, 'No posee permisos suficientes para esta operación.');
    }
    next();
  };
}

/** Atajo: token válido + rol. */
const requiere = (roles) => [verificarToken, verificarRol(roles)];

/** Atajo para las operaciones de la directiva (rol ADMIN). */
const soloAdmin = requiere(['ADMIN']);

function firmarToken(cuenta, { alcance = ALCANCE_COMPLETO } = {}) {
  return jwt.sign(
    {
      cuentaId: cuenta.cuentaId,
      personaId: cuenta.personaId,
      rol: cuenta.rol,
      alcance,
      ts: Date.now()
    },
    env.JWT_SECRET,
    { algorithm: 'HS256', expiresIn: alcance === ALCANCE_CAMBIO_PASSWORD ? '15m' : env.JWT_EXPIRES_IN }
  );
}

module.exports = {
  ALCANCE_COMPLETO,
  ALCANCE_CAMBIO_PASSWORD,
  verificarToken,
  autenticacionOpcional,
  verificarTokenOCambioPassword,
  verificarRol,
  requiere,
  soloAdmin,
  firmarToken
};
