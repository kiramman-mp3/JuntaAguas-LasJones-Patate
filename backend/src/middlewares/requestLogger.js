const crypto = require('crypto');
const defaultLogger = require('../shared/logger');

const UMBRAL_LENTA_MS = 2000;
const ID_VALIDO = /^[A-Za-z0-9._-]{8,64}$/;

/**
 * Asigna un identificador a cada petición (se devuelve en `X-Request-Id` para que el usuario pueda
 * citarlo al reportar un fallo) y registra una línea al terminar: método, ruta sin query string,
 * estado, duración, IP y cuenta. No registra cuerpos, cabeceras ni parámetros de la URL.
 */
function requestLogger(logger = defaultLogger) {
  return (req, res, next) => {
    const entrante = req.headers['x-request-id'];
    req.id = typeof entrante === 'string' && ID_VALIDO.test(entrante) ? entrante : crypto.randomUUID();
    res.setHeader('X-Request-Id', req.id);
    const inicio = process.hrtime.bigint();

    res.on('finish', () => {
      const duracionMs = Math.round(Number(process.hrtime.bigint() - inicio) / 1e5) / 10;
      const campos = {
        reqId: req.id,
        metodo: req.method,
        ruta: req.originalUrl.split('?')[0],
        estado: res.statusCode,
        duracionMs,
        ip: req.ip,
        cuentaId: req.user?.cuentaId ?? null
      };
      if (res.statusCode >= 500) logger.error('petición fallida', campos);
      else if (res.statusCode >= 400 || duracionMs > UMBRAL_LENTA_MS) logger.warn(duracionMs > UMBRAL_LENTA_MS ? 'petición lenta' : 'petición rechazada', campos);
      // La comprobación de salud la consulta un monitor cada pocos segundos: no llena el registro.
      else if (campos.ruta === '/api/health') logger.debug('petición', campos);
      else logger.info('petición', campos);
    });

    next();
  };
}

module.exports = requestLogger;
