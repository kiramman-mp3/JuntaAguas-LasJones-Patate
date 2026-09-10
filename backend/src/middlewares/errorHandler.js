/**
 * Middleware centralizado de manejo de errores HTTP
 */
function errorHandler(err, req, res, next) {
  console.error('[Global Error]', err);

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Error interno del servidor.';

  res.status(statusCode).json({
    status: 'ERROR',
    statusCode,
    message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
}

module.exports = errorHandler;
