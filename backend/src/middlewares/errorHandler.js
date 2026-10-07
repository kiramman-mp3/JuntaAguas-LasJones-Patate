const { ZodError } = require('zod');
const multer = require('multer');
const { HttpError } = require('../shared/errors');
const env = require('../config/env');

function mensajeZod(error) {
  const primero = error.issues[0];
  if (!primero) return 'Datos de entrada inválidos.';
  const campo = primero.path.join('.');
  return campo ? `${campo}: ${primero.message}` : primero.message;
}

/**
 * Middleware centralizado de errores. Nunca expone mensajes SQL ni trazas al cliente.
 */
function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) {
    return res.status(err.statusCode).json({ status: 'ERROR', message: err.message, ...(err.detalle ?? {}) });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({ status: 'ERROR', message: mensajeZod(err) });
  }

  if (err instanceof multer.MulterError) {
    const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'El archivo supera el tamaño máximo permitido.' : 'Archivo inválido.';
    return res.status(status).json({ status: 'ERROR', message });
  }

  if (err.type === 'entity.too.large') {
    return res.status(413).json({ status: 'ERROR', message: 'La solicitud es demasiado grande.' });
  }

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ status: 'ERROR', message: 'El cuerpo de la solicitud no es un JSON válido.' });
  }

  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ status: 'ERROR', message: 'El registro ya existe.' });
  }

  if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    return res.status(400).json({ status: 'ERROR', message: 'Una de las referencias enviadas no existe.' });
  }

  if (!env.esTest) console.error('[Error no controlado]', err);

  return res.status(500).json({ status: 'ERROR', message: 'Error interno del servidor.' });
}

function notFoundHandler(req, res) {
  res.status(404).json({ status: 'ERROR', message: 'Ruta no encontrada.' });
}

module.exports = errorHandler;
module.exports.notFoundHandler = notFoundHandler;
