const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { registrarAuditoria } = require('../services/auditService');

/**
 * Iniciar sesión con cédula y contraseña
 */
async function login(req, res, next) {
  try {
    const { cedula, password } = req.body;

    if (!cedula || !password) {
      return res.status(400).json({ status: 'ERROR', message: 'Se requiere cédula y contraseña.' });
    }

    // Buscar persona y cuenta asociada
    const [rows] = await db.query(
      `SELECT c.id AS cuenta_id, c.password_hash, c.estado AS estado_cuenta, c.debe_cambiar_password,
              p.id AS persona_id, p.cedula, p.nombres, p.apellidos, p.email, p.estado AS estado_persona,
              r.codigo AS rol_codigo, r.nombre AS rol_nombre
       FROM personas p
       JOIN cuentas c ON c.persona_id = p.id
       JOIN roles r ON r.id = c.rol_id
       WHERE p.cedula = ?`,
      [cedula.trim()]
    );

    if (rows.length === 0) {
      return res.status(401).json({ status: 'ERROR', message: 'Credenciales inválidas. Cédula no registrada o sin cuenta.' });
    }

    const user = rows[0];

    if (user.estado_cuenta !== 'ACTIVA' || user.estado_persona !== 'ACTIVO') {
      return res.status(403).json({ status: 'ERROR', message: 'La cuenta o el comunero se encuentra inactivo/bloqueado.' });
    }

    // Comparar hash bcrypt
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ status: 'ERROR', message: 'Credenciales inválidas. Contraseña incorrecta.' });
    }

    // Actualizar último acceso
    await db.query(`UPDATE cuentas SET ultimo_acceso = NOW() WHERE id = ?`, [user.cuenta_id]);

    // Generar Token JWT
    const secret = process.env.JWT_SECRET || 'super_secret_key_junta_las_jones_2026';
    const token = jwt.sign(
      {
        cuentaId: user.cuenta_id,
        personaId: user.persona_id,
        cedula: user.cedula,
        nombres: user.nombres,
        apellidos: user.apellidos,
        rol: user.rol_codigo
      },
      secret,
      { expiresIn: '24h' }
    );

    // Auditoría
    await registrarAuditoria({
      cuentaId: user.cuenta_id,
      accion: 'LOGIN',
      entidad: 'cuentas',
      entidadId: user.cuenta_id,
      ip: req.ip,
      detalle: { cedula: user.cedula, rol: user.rol_codigo }
    });

    return res.json({
      status: 'OK',
      message: 'Inicio de sesión exitoso.',
      token,
      user: {
        cuentaId: user.cuenta_id,
        personaId: user.persona_id,
        cedula: user.cedula,
        nombres: user.nombres,
        apellidos: user.apellidos,
        email: user.email,
        rol: user.rol_codigo,
        rolNombre: user.rol_nombre,
        debeCambiarPassword: Boolean(user.debe_cambiar_password)
      }
    });

  } catch (error) {
    next(error);
  }
}

/**
 * Cambiar contraseña de la cuenta activa
 */
async function changePassword(req, res, next) {
  try {
    const { actualPassword, nuevaPassword } = req.body;
    const cuentaId = req.user.cuentaId;

    if (!nuevaPassword || nuevaPassword.length < 6) {
      return res.status(400).json({ status: 'ERROR', message: 'La nueva contraseña debe tener al menos 6 caracteres.' });
    }

    const [rows] = await db.query(`SELECT password_hash FROM cuentas WHERE id = ?`, [cuentaId]);
    if (rows.length === 0) {
      return res.status(404).json({ status: 'ERROR', message: 'Cuenta no encontrada.' });
    }

    if (actualPassword) {
      const match = await bcrypt.compare(actualPassword, rows[0].password_hash);
      if (!match) {
        return res.status(400).json({ status: 'ERROR', message: 'La contraseña actual ingresada es incorrecta.' });
      }
    }

    const newHash = await bcrypt.hash(nuevaPassword, 10);

    await db.query(
      `UPDATE cuentas
       SET password_hash = ?, debe_cambiar_password = FALSE, password_updated_at = NOW()
       WHERE id = ?`,
      [newHash, cuentaId]
    );

    await registrarAuditoria({
      cuentaId,
      accion: 'MODIFICAR',
      entidad: 'cuentas',
      entidadId: cuentaId,
      ip: req.ip,
      detalle: { cambioPassword: true }
    });

    return res.json({ status: 'OK', message: 'Contraseña actualizada correctamente.' });
  } catch (error) {
    next(error);
  }
}

/**
 * Obtener datos del perfil autenticado
 */
async function getMe(req, res, next) {
  try {
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

    if (rows.length === 0) {
      return res.status(404).json({ status: 'ERROR', message: 'Usuario no encontrado.' });
    }

    return res.json({ status: 'OK', user: rows[0] });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  login,
  changePassword,
  getMe
};
