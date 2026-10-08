const { EventEmitter } = require('events');

/** Cliente de WhatsApp Web simulado: sin navegador, controlado desde la prueba. */
class ClienteFalso extends EventEmitter {
  constructor({ chats = [], falloInicio = null, falloListar = null, sinConfirmacion = false } = {}) {
    super();
    this.chats = chats;
    this.falloInicio = falloInicio;
    this.falloListar = falloListar;
    this.sinConfirmacion = sinConfirmacion;
    this.enviados = [];
    this.destruido = false;
    this.cerroSesion = false;
  }

  async initialize() {
    if (this.falloInicio) throw this.falloInicio;
  }

  async destroy() {
    this.destruido = true;
  }

  async logout() {
    this.cerroSesion = true;
  }

  async listarGrupos() {
    if (this.falloListar) throw this.falloListar;
    return this.chats
      .filter(({ esGrupo = true }) => esGrupo)
      .map(({ id, nombre, participantes = 3 }) => ({ id, nombre, participantes }));
  }

  async enviarTexto(id, texto) {
    const chat = this.chats.find((c) => c.id === id);
    if (chat?.falloEnvio) throw chat.falloEnvio;
    if (this.sinConfirmacion) return undefined;
    this.enviados.push({ id, texto });
    return { id: { _serialized: `msg-${this.enviados.length}` } };
  }
}

const logSilencioso = { log() {}, error() {} };

module.exports = { ClienteFalso, logSilencioso };
