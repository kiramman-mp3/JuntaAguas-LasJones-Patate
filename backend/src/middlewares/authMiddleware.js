const jwt = require('jsonwebtoken');
require('dotenv').config();

/**
 * Middleware para verificar token JWT en peticiones protegidas
 */
function verificarToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ status: 'ERROR', message: 'Acceso no autorizado. Se requiere token JWT.' });
  }

  const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_key_junta_las_jones_2026');
    req.user = decoded; // { cuentaId, personaId, cedula, rol, usuario }
    next();
  } catch (error) {
    return res.status(403).json({ status: 'ERROR', message: 'Token inválido o expirado.' });
  }
}

/**
 * Middleware opcional para extraer token si está presente pero no rechazar si no hay token (endpoints públicos con enriquecimiento)
 */
function tokenOpcional(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (authHeader) {
    const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader;
    try {
      req.user = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_key_junta_las_jones_2026');
    } catch (e) {
      req.user = null;
    }
  }
  next();
}

/**
 * Middleware para validar rol específico de usuario
 * @param {Array<string>} rolesPermitidos - Lista de códigos de roles permitidos ej: ['ADMIN']
 */
function verificarRol(rolesPermitidos = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ status: 'ERROR', message: 'Usuario no autenticado.' });
    }

    if (rolesPermitidos.length > 0 && !rolesPermitidos.includes(req.user.rol)) {
      return res.status(403).json({
        status: 'ERROR',
        message: `No posee permisos suficientes. Permiso requerido: ${rolesPermitidos.join(', ')}`
      });
    }

    next();
  };
}

module.exports = {
  verificarToken,
  tokenOpcional,
  verificarRol
};
