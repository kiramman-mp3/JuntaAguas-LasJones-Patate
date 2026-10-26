const env = require('../config/env');

const NIVELES = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 };

/** Convierte un Error en un objeto serializable; el resto de valores pasan sin cambios. */
function serializar(valor) {
  if (valor instanceof Error) {
    return { nombre: valor.name, mensaje: valor.message, codigo: valor.code, stack: valor.stack };
  }
  return valor;
}

/**
 * Logger mínimo sin dependencias: una línea JSON por evento en producción (fácil de filtrar con
 * jq, journalctl o cualquier recolector) y texto legible en desarrollo. Los errores van a stderr.
 * Nunca registre contraseñas, tokens ni cuerpos de peticiones.
 */
function crearLogger({ nivel = 'info', json = false, salida = process.stdout, salidaError = process.stderr, ahora = () => new Date() } = {}) {
  const minimo = NIVELES[nivel] ?? NIVELES.info;

  function escribir(nombreNivel, mensaje, campos = {}) {
    if (NIVELES[nombreNivel] < minimo) return;
    const datos = {};
    for (const [clave, valor] of Object.entries(campos)) datos[clave] = serializar(valor);
    const destino = nombreNivel === 'error' ? salidaError : salida;
    if (json) {
      destino.write(`${JSON.stringify({ hora: ahora().toISOString(), nivel: nombreNivel, mensaje, ...datos })}\n`);
      return;
    }
    const extra = Object.keys(datos).length ? ` ${JSON.stringify(datos)}` : '';
    destino.write(`[${nombreNivel}] ${mensaje}${extra}\n`);
  }

  return {
    debug: (mensaje, campos) => escribir('debug', mensaje, campos),
    info: (mensaje, campos) => escribir('info', mensaje, campos),
    warn: (mensaje, campos) => escribir('warn', mensaje, campos),
    error: (mensaje, campos) => escribir('error', mensaje, campos)
  };
}

const logger = crearLogger({ nivel: env.LOG_LEVEL, json: env.esProduccion });

module.exports = logger;
module.exports.crearLogger = crearLogger;
