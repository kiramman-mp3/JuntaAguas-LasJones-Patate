/**
 * Servicio de WhatsApp para las pruebas: es el servicio real (whatsapp-service/src/app.js y sesion.js)
 * con un cliente de WhatsApp Web de mentira, así que el backend y la interfaz lo usan como en producción
 * sin navegador ni teléfono. Las pruebas lo gobiernan con la API de control /__control (mismo token):
 *
 *   POST /__control/escanear   el teléfono "escanea" el QR y la sesión queda conectada
 *   POST /__control/reiniciar  vuelve al estado inicial (sin sesión, sin mensajes, sin fallos)
 *   POST /__control/caer       el servicio deja de responder (como si estuviera apagado)
 *   POST /__control/fallo      el siguiente envío a un grupo falla  { activo: true|false }
 *   GET  /__control/enviados   mensajes publicados hasta ahora
 */
const path = require('path');
const http = require('http');
const { EventEmitter } = require('events');

const servicio = path.join(__dirname, '..', 'whatsapp-service');
const express = require(path.join(servicio, 'node_modules', 'express'));
const { crearApp } = require(path.join(servicio, 'src', 'app.js'));
const { SesionWhatsApp } = require(path.join(servicio, 'src', 'sesion.js'));

const GRUPOS = [
  { id: '120363000000000001@g.us', nombre: 'Usuarios Junta La Jones', participantes: 118 },
  { id: '120363000000000002@g.us', nombre: 'Directiva La Jones', participantes: 9 },
  { id: '120363000000000003@g.us', nombre: 'Familia Moreta', participantes: 14 }
];

class ClienteSimulado extends EventEmitter {
  constructor(estado) {
    super();
    this.estado = estado;
  }

  async initialize() {
    // Un QR nuevo cada vez que se inicia; el teléfono lo "escanea" cuando la prueba lo ordena.
    setImmediate(() => this.emit('qr', `qr-simulado-${Date.now()}`));
  }

  async destroy() {}

  async logout() {}

  async listarGrupos() {
    return GRUPOS;
  }

  async enviarTexto(id, texto) {
    if (this.estado.falloEnvio) throw new Error('WhatsApp rechazó el mensaje (simulado)');
    this.estado.enviados.push({ grupoId: id, texto, fecha: new Date().toISOString() });
    return { id: { _serialized: `msg-${this.estado.enviados.length}` } };
  }
}

function iniciarWhatsAppSimulado({ puerto, token }) {
  const estado = { falloEnvio: false, caido: false, enviados: [], cliente: null };

  const sesion = new SesionWhatsApp({
    crearCliente: () => {
      estado.cliente = new ClienteSimulado(estado);
      return estado.cliente;
    },
    generarQr: async (texto) => `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><title>${texto}</title><rect width="8" height="8"/></svg>`)}`,
    log: { log() {}, error() {} }
  });

  const app = express();
  app.use(express.json());
  // Caído: la conexión se corta sin respuesta, como un servicio apagado.
  app.use((req, res, next) => (estado.caido && !req.path.startsWith('/__control') ? req.socket.destroy() : next()));

  app.use('/__control', (req, res, next) => (req.headers.authorization === `Bearer ${token}` ? next() : res.status(401).end()));
  app.post('/__control/escanear', (req, res) => {
    estado.cliente?.emit('authenticated');
    estado.cliente?.emit('ready');
    res.json({ ok: true });
  });
  app.post('/__control/reiniciar', async (req, res) => {
    await sesion.cerrarSesion();
    Object.assign(estado, { falloEnvio: false, caido: false, enviados: [] });
    res.json({ ok: true });
  });
  app.post('/__control/caer', (req, res) => {
    estado.caido = true;
    res.json({ ok: true });
  });
  app.post('/__control/levantar', (req, res) => {
    estado.caido = false;
    res.json({ ok: true });
  });
  app.post('/__control/fallo', (req, res) => {
    estado.falloEnvio = req.body?.activo !== false;
    res.json({ ok: true });
  });
  app.get('/__control/enviados', (req, res) => res.json({ data: estado.enviados }));

  app.use(crearApp({ sesion, token, log: { log() {}, error() {} } }));

  const servidor = http.createServer(app);
  return new Promise((resolver, rechazar) => {
    servidor.once('error', rechazar);
    servidor.listen(puerto, '127.0.0.1', () => resolver({ cerrar: () => servidor.close(), GRUPOS }));
  });
}

module.exports = { iniciarWhatsAppSimulado, GRUPOS };
