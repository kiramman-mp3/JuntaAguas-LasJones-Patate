const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const fs = require('fs');
const db = require('../config/db');

let client = null;
let qrCodeDataUrl = '';
let isReady = false;
let isInitializing = false;
let status = 'DISCONNECTED'; // DISCONNECTED, INITIALIZING, QR_READY, READY, AUTHENTICATED
let statusMessage = 'Desconectado';

function getExecutablePath() {
  const possiblePaths = [
    process.env.CHROME_BIN,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA ? `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe` : null,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
  ];

  for (const p of possiblePaths) {
    if (p && fs.existsSync(p)) {
      console.log('[WhatsApp Service] Usando navegador instalado:', p);
      return p;
    }
  }
  return undefined;
}

let initStartTime = 0;

function initWhatsApp(force = false) {
  const now = Date.now();
  if (isInitializing && (now - initStartTime > 40000)) {
    console.log('[WhatsApp Service] Tiempo de espera superado. Reseteando estado de inicialización...');
    isInitializing = false;
    status = 'DISCONNECTED';
  }

  if (!force && (isInitializing || isReady)) return;

  if (force && client) {
    try { client.destroy(); } catch (e) {}
    client = null;
    isReady = false;
  }

  isInitializing = true;
  initStartTime = Date.now();
  status = 'INITIALIZING';
  statusMessage = 'Inicializando servicio de WhatsApp...';
  qrCodeDataUrl = '';


  try {
    const executablePath = getExecutablePath();
    const puppeteerOpts = {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu'
      ]
    };

    if (executablePath) {
      puppeteerOpts.executablePath = executablePath;
    }

    client = new Client({
      authStrategy: new LocalAuth({ dataPath: './.wwebjs_auth' }),
      puppeteer: puppeteerOpts
    });


    client.on('qr', async (qr) => {
      try {
        qrCodeDataUrl = await qrcode.toDataURL(qr);
        status = 'QR_READY';
        statusMessage = 'Escanea el código QR con la app de WhatsApp';
        console.log('[WhatsApp Service] Código QR generado para escaneo.');
      } catch (err) {
        console.error('[WhatsApp Service] Error generando DataURL de QR:', err);
      }
    });

    client.on('ready', () => {
      isReady = true;
      isInitializing = false;
      status = 'READY';
      statusMessage = 'Conectado a WhatsApp';
      qrCodeDataUrl = '';
      console.log('[WhatsApp Service] Cliente de WhatsApp conectado y listo.');
    });

    client.on('authenticated', () => {
      status = 'AUTHENTICATED';
      statusMessage = 'Autenticado correctamente';
      console.log('[WhatsApp Service] Sesión autenticada.');
    });

    client.on('auth_failure', (msg) => {
      isReady = false;
      isInitializing = false;
      status = 'DISCONNECTED';
      statusMessage = 'Fallo de autenticación: ' + msg;
      qrCodeDataUrl = '';
      console.error('[WhatsApp Service] Fallo de autenticación:', msg);
    });

    client.on('disconnected', (reason) => {
      isReady = false;
      isInitializing = false;
      status = 'DISCONNECTED';
      statusMessage = 'Desconectado: ' + reason;
      qrCodeDataUrl = '';
      client = null;
      console.log('[WhatsApp Service] Cliente desconectado:', reason);
    });

    client.initialize().catch((err) => {
      console.error('[WhatsApp Service] Error al inicializar:', err);
      isInitializing = false;
      status = 'DISCONNECTED';
      statusMessage = 'Error al iniciar servicio de WhatsApp: ' + err.message;
    });
  } catch (err) {
    console.error('[WhatsApp Service] Excepción al crear cliente:', err);
    isInitializing = false;
    status = 'DISCONNECTED';
    statusMessage = 'Excepción al crear cliente: ' + err.message;
  }
}

function getStatus() {
  return {
    status,
    statusMessage,
    isReady,
    qrCodeDataUrl
  };
}

async function logoutWhatsApp() {
  if (client) {
    try {
      await client.logout();
    } catch (err) {
      console.error('[WhatsApp Service] Error en logout:', err);
    }
    client = null;
  }
  isReady = false;
  isInitializing = false;
  status = 'DISCONNECTED';
  statusMessage = 'Sesión cerrada';
  qrCodeDataUrl = '';
  return { status: 'OK', message: 'Sesión de WhatsApp cerrada exitosamente.' };
}

/**
 * Enviar convocatoria de Minga por WhatsApp a todos los comuneros activos
 */
async function enviarConvocatoriaMinga(eventoId) {
  if (!isReady || !client) {
    throw new Error('El servicio de WhatsApp no está conectado. Escanee el código QR desde el panel de administración.');
  }

  // Obtener datos del evento
  const [eventos] = await db.query(`SELECT * FROM eventos WHERE id = ?`, [eventoId]);
  if (eventos.length === 0) {
    throw new Error('Evento no encontrado.');
  }

  const evento = eventos[0];

  // Obtener comuneros activos con número de teléfono
  const [personas] = await db.query(
    `SELECT id, nombres, apellidos, telefono FROM personas WHERE estado = 'ACTIVO' AND telefono IS NOT NULL AND TRIM(telefono) != ''`
  );

  if (personas.length === 0) {
    return {
      status: 'OK',
      message: 'No hay comuneros activos con número de teléfono registrado.',
      enviados: 0,
      fallidos: 0
    };
  }

  // Formatear fecha
  const fechaFmt = evento.fecha ? new Date(evento.fecha).toLocaleDateString('es-EC') : evento.fecha;

  const mensajeTemplate = `📢 *CONVOCATORIA A MINGA COMUNITARIA*
*Junta Administradora de Agua y Riego "La Jones"* - Patate

📌 *Asunto:* ${evento.titulo}
📅 *Fecha:* ${fechaFmt}
⏰ *Hora:* ${evento.hora_inicio}
📍 *Lugar:* ${evento.lugar || 'Casa Comunal Junta La Jones'}

${evento.descripcion ? `📝 *Detalles:* ${evento.descripcion}\n` : ''}⚠️ *Nota:* ${evento.genera_multa_ausencia ? `La asistencia es OBLIGATORIA. La inasistencia generará una multa de $${Number(evento.valor_multa).toFixed(2)}.` : 'Se solicita su puntual asistencia.'}

Por favor tomar la debida nota y asistir puntualmente con sus herramientas de trabajo.`;

  let enviados = 0;
  let fallidos = 0;

  for (const persona of personas) {
    let rawNumber = persona.telefono.replace(/\D/g, ''); // Solo dígitos
    if (!rawNumber) continue;

    if (rawNumber.startsWith('0')) {
      rawNumber = '593' + rawNumber.substring(1);
    } else if (!rawNumber.startsWith('593')) {
      rawNumber = '593' + rawNumber;
    }

    const chatId = `${rawNumber}@c.us`;

    try {
      await client.sendMessage(chatId, mensajeTemplate);
      enviados++;

      await db.query(
        `INSERT INTO envios_convocatoria (evento_id, persona_id, canal, destino, estado, fecha_envio)
         VALUES (?, ?, 'WHATSAPP', ?, 'ENVIADO', NOW())`,
        [eventoId, persona.id, rawNumber]
      );
    } catch (err) {
      fallidos++;
      console.error(`[WhatsApp Service] Error enviando a ${persona.nombres} (${rawNumber}):`, err.message);

      await db.query(
        `INSERT INTO envios_convocatoria (evento_id, persona_id, canal, destino, estado, detalle_error)
         VALUES (?, ?, 'WHATSAPP', ?, 'ERROR', ?)`,
        [eventoId, persona.id, rawNumber, err.message]
      );
    }
  }

  return {
    status: 'OK',
    message: `Convocatoria enviada por WhatsApp a comuneros. Exitosos: ${enviados}, Fallidos: ${fallidos}`,
    totalComuneros: personas.length,
    enviados,
    fallidos
  };
}

module.exports = {
  initWhatsApp,
  getStatus,
  logoutWhatsApp,
  enviarConvocatoriaMinga
};
