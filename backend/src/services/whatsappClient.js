/**
 * Cliente HTTP del servicio de WhatsApp (whatsapp-service/). El backend no ejecuta WhatsApp Web:
 * si el servicio está caído, la API sigue funcionando y solo fallan las operaciones de WhatsApp.
 */
const env = require('../config/env');
const { HttpError } = require('../shared/errors');

const NO_CONFIGURADO = 'El servicio de WhatsApp no está configurado: defina WHATSAPP_SERVICE_TOKEN en backend/.env.';
const NO_DISPONIBLE = 'El servicio de WhatsApp no está disponible. Verifique que esté en ejecución.';
// Enviar un mensaje puede tardar más que una consulta de estado.
const TIEMPO_ENVIO_MS = 60000;

const configurado = () => Boolean(env.WHATSAPP_SERVICE_TOKEN);

async function llamar(ruta, { metodo = 'GET', cuerpo, tiempoMs = env.WHATSAPP_TIMEOUT_MS } = {}) {
  if (!configurado()) throw new HttpError(503, NO_CONFIGURADO);

  let respuesta;
  try {
    respuesta = await fetch(new URL(ruta, env.WHATSAPP_SERVICE_URL), {
      method: metodo,
      headers: {
        Authorization: `Bearer ${env.WHATSAPP_SERVICE_TOKEN}`,
        ...(cuerpo ? { 'Content-Type': 'application/json' } : {})
      },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
      signal: AbortSignal.timeout(tiempoMs)
    });
  } catch (error) {
    throw new HttpError(503, error.name === 'TimeoutError' ? 'El servicio de WhatsApp no respondió a tiempo.' : NO_DISPONIBLE);
  }

  const datos = await respuesta.json().catch(() => null);
  if (respuesta.ok) return datos?.data;
  if (respuesta.status === 401) {
    throw new HttpError(503, 'El servicio de WhatsApp rechazó al backend: WHATSAPP_SERVICE_TOKEN debe ser igual en backend/.env y whatsapp-service/.env.');
  }
  // Los errores 4xx del servicio traen mensajes pensados para el usuario; los 5xx son fallos de WhatsApp.
  throw new HttpError(respuesta.status >= 500 ? 502 : respuesta.status, datos?.message || 'El servicio de WhatsApp no pudo completar la operación.');
}

/** Estado de la conexión. Nunca falla: si el servicio no responde lo informa como estado. */
async function estado() {
  try {
    return await llamar('/estado');
  } catch (error) {
    return { estado: configurado() ? 'NO_DISPONIBLE' : 'NO_CONFIGURADO', conectado: false, mensaje: error.message, qr: null };
  }
}

const iniciar = () => llamar('/sesion/iniciar', { metodo: 'POST' });
const cerrarSesion = () => llamar('/sesion/cerrar', { metodo: 'POST' });
const listarGrupos = () => llamar('/grupos');
const enviarAGrupo = (grupoId, texto) =>
  llamar(`/grupos/${encodeURIComponent(grupoId)}/mensajes`, { metodo: 'POST', cuerpo: { texto }, tiempoMs: TIEMPO_ENVIO_MS });

module.exports = { configurado, estado, iniciar, cerrarSesion, listarGrupos, enviarAGrupo };
