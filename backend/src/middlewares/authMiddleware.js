const jwt = require('jsonwebtoken');
const env = require('../config/env');

/**
 * Middleware para verificar token JWT en peticiones protegidas
 */
function verificarToken(req, res, next) {
  let token = null;
  const authHeader = req.headers['authorization'];

  if (authHeader) {
    token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader;
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ status: 'ERROR', message: 'Acceso no autorizado. Se requiere token JWT.' });
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    req.user = decoded; // { cuentaId, personaId, cedula, rol, usuario }
    next();
  } catch (error) {
    return res.status(401).json({ status: 'ERROR', message: 'Token JWT inválido o no autorizado.' });
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
      req.user = jwt.verify(token, env.JWT_SECRET);
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
