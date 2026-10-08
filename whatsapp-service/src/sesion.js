/**
 * Sesión de WhatsApp Web de la Junta: un único cliente, que solo se inicia por una orden
 * explícita (nunca al consultar el estado) y que se descarta si falla o no termina de conectarse.
 */

const ESTADOS = Object.freeze({
  DESCONECTADO: 'DESCONECTADO',
  INICIANDO: 'INICIANDO',
  ESPERANDO_QR: 'ESPERANDO_QR',
  CONECTADO: 'CONECTADO'
});

/** Tiempo máximo para conectarse (incluye escanear el QR); después se libera el navegador. */
const TIEMPO_INICIO_MS = 3 * 60 * 1000;
const GRUPO_ID = /^[\d-]+@g\.us$/;
const MAX_TEXTO = 4000;
/**
 * WhatsApp Web a veces recarga la página mientras whatsapp-web.js la prepara y el arranque falla
 * con estos errores; un intento nuevo suele funcionar. Otros errores no se reintentan.
 */
const ERROR_TRANSITORIO = /Execution context was destroyed|because of a navigation|Target closed/i;
const MAX_INTENTOS = 3;

/** Error con código HTTP que el servicio devuelve tal cual al backend. */
class ErrorServicio extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

class SesionWhatsApp {
  #crearCliente;
  #generarQr;
  #tiempoInicioMs;
  #maxIntentos;
  #log;
  #cliente = null;
  #estado = ESTADOS.DESCONECTADO;
  #mensaje = 'WhatsApp no está conectado.';
  #qr = null;
  #temporizador = null;

  /**
   * @param {object} opciones
   * @param {() => import('whatsapp-web.js').Client} opciones.crearCliente fábrica del cliente de WhatsApp Web
   * @param {(qr: string) => Promise<string>} opciones.generarQr convierte el texto del QR en una imagen (data URL)
   */
  constructor({ crearCliente, generarQr, tiempoInicioMs = TIEMPO_INICIO_MS, maxIntentos = MAX_INTENTOS, log = console }) {
    this.#crearCliente = crearCliente;
    this.#generarQr = generarQr;
    this.#tiempoInicioMs = tiempoInicioMs;
    this.#maxIntentos = maxIntentos;
    this.#log = log;
  }

  estado() {
    return {
      estado: this.#estado,
      conectado: this.#estado === ESTADOS.CONECTADO,
      mensaje: this.#mensaje,
      qr: this.#qr
    };
  }

  /** Inicia el cliente si no hay uno en curso. Llamarlo de nuevo no crea otro navegador. */
  iniciar() {
    if (this.#cliente) return this.estado();
    this.#cambiar(ESTADOS.INICIANDO, 'Iniciando WhatsApp Web…');
    this.#arrancar(1);
    return this.estado();
  }

  #arrancar(intento) {
    const cliente = this.#crearCliente();
    this.#cliente = cliente;

    cliente.on('qr', async (texto) => {
      try {
        const imagen = await this.#generarQr(texto);
        if (cliente !== this.#cliente) return;
        this.#qr = imagen;
        this.#cambiar(ESTADOS.ESPERANDO_QR, 'Escanee el código QR desde WhatsApp → Dispositivos vinculados.');
      } catch (error) {
        this.#log.error('[WhatsApp] No se pudo generar la imagen del QR:', error.message);
      }
    });
    cliente.on('authenticated', () => {
      if (cliente !== this.#cliente) return;
      this.#qr = null;
      this.#cambiar(ESTADOS.INICIANDO, 'Teléfono vinculado. Cargando WhatsApp…');
    });
    cliente.on('ready', () => {
      if (cliente !== this.#cliente) return;
      clearTimeout(this.#temporizador);
      this.#qr = null;
      this.#cambiar(ESTADOS.CONECTADO, 'Conectado a WhatsApp.');
      this.#log.log('[WhatsApp] Conectado.');
    });
    cliente.on('auth_failure', (motivo) => this.#descartar(cliente, `No se pudo vincular el teléfono: ${motivo}`));
    cliente.on('disconnected', (motivo) => this.#descartar(cliente, `WhatsApp se desconectó (${motivo}). Vuelva a conectarlo.`));

    this.#temporizador = setTimeout(
      () => this.#descartar(cliente, 'WhatsApp Web no terminó de conectarse a tiempo. Intente conectar de nuevo.'),
      this.#tiempoInicioMs
    );
    this.#temporizador.unref?.();

    Promise.resolve()
      .then(() => cliente.initialize())
      .catch((error) => {
        if (cliente === this.#cliente && intento < this.#maxIntentos && ERROR_TRANSITORIO.test(error.message)) {
          this.#reintentar(cliente, intento, error);
        } else {
          this.#descartar(cliente, `No se pudo iniciar WhatsApp Web: ${error.message}`);
        }
      });
  }

  /** Libera el navegador fallido y arranca otro, salvo que entretanto se haya detenido o reiniciado. */
  async #reintentar(cliente, intento, error) {
    this.#log.error(`[WhatsApp] Arranque interrumpido (${error.message}). Reintento ${intento + 1} de ${this.#maxIntentos}.`);
    this.#soltarCliente();
    this.#mensaje = 'Reintentando iniciar WhatsApp Web…';
    await this.#destruir(cliente);
    if (!this.#cliente && this.#estado === ESTADOS.INICIANDO) this.#arrancar(intento + 1);
  }

  /** Cierra la sesión vinculada: el teléfono deberá escanear un QR nuevo para volver a conectarse. */
  async cerrarSesion() {
    const cliente = this.#soltarCliente();
    if (cliente) {
      await cliente.logout().catch((error) => this.#log.error('[WhatsApp] Error al cerrar la sesión:', error.message));
      await this.#destruir(cliente);
    }
    this.#cambiar(ESTADOS.DESCONECTADO, 'Sesión de WhatsApp cerrada.');
    return this.estado();
  }

  /** Libera el navegador conservando la sesión vinculada (para apagar el servicio). */
  async detener() {
    const cliente = this.#soltarCliente();
    if (cliente) await this.#destruir(cliente);
    this.#cambiar(ESTADOS.DESCONECTADO, 'Servicio detenido.');
  }

  /** Grupos a los que pertenece la cuenta vinculada, por nombre. */
  async listarGrupos() {
    const cliente = this.#clienteConectado();
    let grupos;
    try {
      grupos = await cliente.listarGrupos();
    } catch (error) {
      this.#log.error('[WhatsApp] No se pudieron leer los grupos:', error.message);
      throw new ErrorServicio(502, 'WhatsApp Web todavía no cargó los grupos. Intente de nuevo en unos segundos.');
    }
    return grupos
      .map((g) => ({ id: g.id, nombre: g.nombre || g.id, participantes: g.participantes ?? null }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }

  /** Envía un mensaje de texto a un grupo de la cuenta vinculada. */
  async enviarAGrupo(grupoId, texto) {
    if (typeof grupoId !== 'string' || !GRUPO_ID.test(grupoId)) throw new ErrorServicio(400, 'El identificador del grupo no es válido.');
    if (typeof texto !== 'string' || !texto.trim()) throw new ErrorServicio(400, 'El mensaje está vacío.');
    if (texto.length > MAX_TEXTO) throw new ErrorServicio(400, `El mensaje supera los ${MAX_TEXTO} caracteres.`);

    const grupos = await this.listarGrupos();
    if (!grupos.some((g) => g.id === grupoId)) {
      throw new ErrorServicio(404, 'El grupo no existe o la cuenta de la Junta ya no pertenece a él.');
    }

    let mensaje;
    try {
      mensaje = await this.#clienteConectado().enviarTexto(grupoId, texto);
    } catch (error) {
      throw new ErrorServicio(502, `WhatsApp no aceptó el mensaje: ${error.message}`);
    }
    if (!mensaje) throw new ErrorServicio(502, 'WhatsApp no confirmó el envío del mensaje.');
    return { mensajeId: mensaje.id?._serialized ?? null };
  }

  #clienteConectado() {
    if (this.#estado !== ESTADOS.CONECTADO || !this.#cliente) {
      throw new ErrorServicio(409, 'WhatsApp no está conectado. Vincule el teléfono de la Junta desde el panel.');
    }
    return this.#cliente;
  }

  #cambiar(estado, mensaje) {
    this.#estado = estado;
    this.#mensaje = mensaje;
    if (estado !== ESTADOS.ESPERANDO_QR) this.#qr = null;
  }

  #soltarCliente() {
    const cliente = this.#cliente;
    this.#cliente = null;
    clearTimeout(this.#temporizador);
    return cliente;
  }

  /** Descarta un cliente que falló; ignora eventos tardíos de clientes ya reemplazados. */
  #descartar(cliente, mensaje) {
    if (cliente !== this.#cliente) return;
    this.#soltarCliente();
    this.#cambiar(ESTADOS.DESCONECTADO, mensaje);
    this.#log.error(`[WhatsApp] ${mensaje}`);
    this.#destruir(cliente);
  }

  async #destruir(cliente) {
    try {
      await cliente.destroy();
    } catch {
      /* el navegador ya estaba cerrado */
    }
  }
}

module.exports = { SesionWhatsApp, ErrorServicio, ESTADOS };
