const { EventEmitter } = require('events');

/** Cliente de WhatsApp Web simulado: sin navegador, controlado desde la prueba. */
class ClienteFalso extends EventEmitter {
  constructor({ chats = [], falloInicio = null } = {}) {
    super();
    this.chats = chats;
    this.falloInicio = falloInicio;
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

  async getChats() {
    return this.chats.map((c) => this.#chat(c));
  }

  async getChatById(id) {
    const chat = this.chats.find((c) => c.id === id);
    if (!chat) throw new Error('chat no encontrado');
    return this.#chat(chat);
  }

  #chat({ id, nombre, esGrupo = true, participantes = 3, falloEnvio = null }) {
    return {
      id: { _serialized: id },
      name: nombre,
      isGroup: esGrupo,
      participants: esGrupo ? Array.from({ length: participantes }) : undefined,
      sendMessage: async (texto) => {
        if (falloEnvio) throw falloEnvio;
        this.enviados.push({ id, texto });
        return { id: { _serialized: `msg-${this.enviados.length}` } };
      }
    };
  }
}

const logSilencioso = { log() {}, error() {} };

module.exports = { ClienteFalso, logSilencioso };
