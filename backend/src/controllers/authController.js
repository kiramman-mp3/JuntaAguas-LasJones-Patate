const { z } = require('zod');
const db = require('../config/db');
const { registrarAuditoria } = require('../services/auditService');
const { firmarToken, ALCANCE_CAMBIO_PASSWORD } = require('../middlewares/authMiddleware');
const { compararPassword, hashPassword, problemaConPassword, HASH_FICTICIO } = require('../shared/passwords');
const { badRequest, unauthorized, notFound } = require('../shared/errors');

const MAX_INTENTOS = 5;
const MINUTOS_BLOQUEO = 15;
const MENSAJE_CREDENCIALES = 'Credenciales incorrectas o la cuenta no está habilitada o se encuentra bloqueada temporalmente.';

const loginSchema = z.object({
  cedula: z.string().trim().min(1, 'Ingrese su cédula.').max(20),
  password: z.string().min(1, 'Ingrese su contraseña.').max(200)
});

const cambioPasswordSchema = z.object({
  actualPassword: z.string().min(1, 'Debe proporcionar su contraseña actual.'),
  nuevaPassword: z.string()
});

function usuarioPublico(fila) {
  return {
    cuentaId: fila.cuenta_id,
    personaId: fila.persona_id,
    cedula: fila.cedula,
    nombres: fila.nombres,
    apellidos: fila.apellidos,
    email: fila.email,
    rol: fila.rol_codigo,
    rolNombre: fila.rol_nombre,
    debeCambiarPassword: Boolean(fila.debe_cambiar_password)
  };
}

async function buscarCuentaPorCedula(cedula) {
  const [rows] = await db.query(
    `SELECT c.id AS cuenta_id, c.password_hash, c.estado AS estado_cuenta, c.debe_cambiar_password,
            c.intentos_fallidos, c.bloqueada_hasta, c.bloqueada_hasta > UTC_TIMESTAMP() AS bloqueada,
            p.id AS persona_id, p.cedula, p.nombres, p.apellidos, p.email, p.estado AS estado_persona,
            r.codigo AS rol_codigo, r.nombre AS rol_nombre
     FROM personas p
     JOIN cuentas c ON c.persona_id = p.id
     JOIN roles r ON r.id = c.rol_id
     WHERE p.cedula = ?`,
    [cedula]
  );
  return rows[0] || null;
}

/**
 * Inicio de sesión. Responde siempre el mismo mensaje ante credenciales inválidas,
 * bloquea la cuenta tras varios intentos fallidos y, si la contraseña es temporal,
 * emite un token que solo sirve para cambiarla.
 */
async function login(req, res) {
  const { cedula, password } = loginSchema.parse(req.body);
  const cuenta = await buscarCuentaPorCedula(cedula);

  // Igualar el tiempo de respuesta aunque la cédula no exista.
  const coincide = await compararPassword(password, cuenta ? cuenta.password_hash : HASH_FICTICIO);

  if (!cuenta || cuenta.estado_cuenta !== 'ACTIVA' || cuenta.estado_persona !== 'ACTIVO') {
    throw unauthorized(MENSAJE_CREDENCIALES);
  }

  if (Number(cuenta.bloqueada)) {
    throw unauthorized(MENSAJE_CREDENCIALES);
  }

  if (!coincide) {
    await db.query('UPDATE cuentas SET intentos_fallidos = intentos_fallidos + 1 WHERE id = ?', [cuenta.cuenta_id]);
    const [[{ intentos_fallidos: intentos }]] = await db.query('SELECT intentos_fallidos FROM cuentas WHERE id = ?', [cuenta.cuenta_id]);

    if (intentos >= MAX_INTENTOS) {
      await db.query(
        'UPDATE cuentas SET intentos_fallidos = 0, bloqueada_hasta = UTC_TIMESTAMP() + INTERVAL ? MINUTE WHERE id = ?',
        [MINUTOS_BLOQUEO, cuenta.cuenta_id]
      );
      await registrarAuditoria({ cuentaId: cuenta.cuenta_id, accion: 'BLOQUEO', entidad: 'cuentas', entidadId: cuenta.cuenta_id, ip: req.ip });
    }
    throw unauthorized(MENSAJE_CREDENCIALES);
  }

  await db.query(
    'UPDATE cuentas SET ultimo_acceso = UTC_TIMESTAMP(), intentos_fallidos = 0, bloqueada_hasta = NULL WHERE id = ?',
    [cuenta.cuenta_id]
  );

  const user = usuarioPublico(cuenta);
  const token = firmarToken(user, user.debeCambiarPassword ? { alcance: ALCANCE_CAMBIO_PASSWORD } : undefined);

  await registrarAuditoria({
    cuentaId: cuenta.cuenta_id, accion: 'LOGIN', entidad: 'cuentas', entidadId: cuenta.cuenta_id, ip: req.ip,
    detalle: { rol: user.rol }
  });

  return res.json({ status: 'OK', message: 'Inicio de sesión exitoso.', token, user });
}

/**
 * Cambia la contraseña de la cuenta autenticada y devuelve un token de sesión completo.
 * Los tokens emitidos antes del cambio dejan de ser válidos.
 */
async function changePassword(req, res) {
  const { actualPassword, nuevaPassword } = cambioPasswordSchema.parse(req.body);

  const problema = problemaConPassword(nuevaPassword, { cedula: req.user.cedula });
  if (problema) throw badRequest(problema);
  if (actualPassword === nuevaPassword) throw badRequest('La nueva contraseña debe ser distinta de la actual.');

  const [rows] = await db.query('SELECT password_hash FROM cuentas WHERE id = ?', [req.user.cuentaId]);
  if (!rows.length) throw notFound('Cuenta no encontrada.');
  if (!(await compararPassword(actualPassword, rows[0].password_hash))) {
    throw badRequest('La contraseña actual ingresada es incorrecta.');
  }

  await db.query(
    `UPDATE cuentas SET password_hash = ?, debe_cambiar_password = FALSE, password_updated_at = UTC_TIMESTAMP(3)
     WHERE id = ?`,
    [await hashPassword(nuevaPassword), req.user.cuentaId]
  );

  await registrarAuditoria({
    cuentaId: req.user.cuentaId, accion: 'MODIFICAR', entidad: 'cuentas', entidadId: req.user.cuentaId, ip: req.ip,
    detalle: { cambioPassword: true }
  });

  const cuenta = await buscarCuentaPorCedula(req.user.cedula);
  const user = usuarioPublico(cuenta);
  return res.json({ status: 'OK', message: 'Contraseña actualizada correctamente.', token: firmarToken(user), user });
}

/** Perfil de la cuenta autenticada. */
async function getMe(req, res) {
  const [rows] = await db.query(
    `SELECT c.id AS cuenta_id, c.debe_cambiar_password, c.ultimo_acceso,
            p.id AS persona_id, p.cedula, p.nombres, p.apellidos, p.email, p.telefono, p.celular, p.direccion,
            r.codigo AS rol_codigo, r.nombre AS rol_nombre
     FROM cuentas c
     JOIN personas p ON p.id = c.persona_id
     JOIN roles r ON r.id = c.rol_id
     WHERE c.id = ?`,
    [req.user.cuentaId]
  );
  if (!rows.length) throw notFound('Usuario no encontrado.');
  const fila = rows[0];
  return res.json({
    status: 'OK',
    user: { ...usuarioPublico(fila), telefono: fila.telefono, celular: fila.celular, direccion: fila.direccion, ultimoAcceso: fila.ultimo_acceso }
  });
}

module.exports = { login, changePassword, getMe };
