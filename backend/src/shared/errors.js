/**
 * Error HTTP con código de estado. El middleware de errores lo traduce a la respuesta JSON estándar.
 */
class HttpError extends Error {
  constructor(statusCode, message, detalle) {
    super(message);
    this.statusCode = statusCode;
    if (detalle !== undefined) this.detalle = detalle;
  }
}

const badRequest = (message, detalle) => new HttpError(400, message, detalle);
const unauthorized = (message = 'Acceso no autorizado.') => new HttpError(401, message);
const forbidden = (message = 'No posee permisos suficientes para esta operación.') => new HttpError(403, message);
const notFound = (message = 'Recurso no encontrado.') => new HttpError(404, message);
const conflict = (message, detalle) => new HttpError(409, message, detalle);

module.exports = { HttpError, badRequest, unauthorized, forbidden, notFound, conflict };
