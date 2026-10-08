const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });

/**
 * Lee y valida la configuración del servicio (whatsapp-service/.env).
 * @param {NodeJS.ProcessEnv} entorno
 */
function leerConfiguracion(entorno = process.env) {
  const problemas = [];
  const token = entorno.WHATSAPP_SERVICE_TOKEN || '';
  if (token.length < 32) problemas.push('WHATSAPP_SERVICE_TOKEN es obligatorio y debe tener al menos 32 caracteres.');

  const puerto = Number(entorno.WHATSAPP_PORT || 3100);
  if (!Number.isInteger(puerto) || puerto <= 0 || puerto > 65535) problemas.push('WHATSAPP_PORT debe ser un número de puerto válido.');

  if (problemas.length) {
    throw new Error(`Configuración inválida en whatsapp-service/.env:\n  - ${problemas.join('\n  - ')}`);
  }

  return {
    token,
    puerto,
    host: entorno.WHATSAPP_HOST || '127.0.0.1',
    authDir: path.resolve(entorno.WHATSAPP_AUTH_DIR || path.join(__dirname, '../.wwebjs_auth')),
    chromeBin: entorno.CHROME_BIN || null
  };
}

module.exports = { leerConfiguracion };
