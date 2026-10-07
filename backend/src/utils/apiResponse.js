/**
 * Utilidad para estandarizar las respuestas de la API.
 */

const successResponse = (res, message, data = null, statusCode = 200) => {
  const response = {
    status: 'OK',
    message
  };
  if (data !== null) {
    response.data = data;
  }
  return res.status(statusCode).json(response);
};

const errorResponse = (res, message, error = null, statusCode = 500) => {
  const response = {
    status: 'ERROR',
    message
  };
  if (error) {
    response.error = error;
  }
  return res.status(statusCode).json(response);
};

module.exports = {
  successResponse,
  errorResponse
};
