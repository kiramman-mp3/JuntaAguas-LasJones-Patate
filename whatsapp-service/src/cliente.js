const fs = require('fs');

// En Windows se prefiere Edge: viene instalado en Windows 10/11 y, con un perfil nuevo, Chrome
// falla al cargar WhatsApp Web ("Execution context was destroyed") mientras Edge funciona.
// CHROME_BIN permite elegir otro navegador.
const NAVEGADORES = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  process.env.LOCALAPPDATA ? `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe` : null,
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser'
];

/** Navegador configurado o el primero instalado; sin ninguno, puppeteer usa el que descargó. */
function navegador(chromeBin) {
  return [chromeBin, ...NAVEGADORES].find((ruta) => ruta && fs.existsSync(ruta));
}

/**
 * Se ejecuta dentro de WhatsApp Web. Lee los grupos de la lista de chats ya cargada, sin pedir
 * nada a los servidores de WhatsApp: getChats() de whatsapp-web.js consulta los metadatos de cada
 * grupo y, si uno falla (por ejemplo, un grupo del que la cuenta salió), falla toda la lista.
 */
/* global window */
function gruposEnLaPagina() {
  const grupos = [];
  for (const chat of window.require('WAWebCollections').Chat.getModelsArray()) {
    try {
      if (chat.id?.server !== 'g.us') continue;
      const participantes = chat.groupMetadata?.participants;
      grupos.push({
        id: chat.id._serialized,
        nombre: chat.formattedTitle || chat.name || chat.groupMetadata?.subject || null,
        participantes: participantes?.getModelsArray?.().length ?? participantes?.length ?? null
      });
    } catch {
      /* un chat con datos incompletos no impide listar los demás */
    }
  }
  return grupos;
}

/**
 * Fábrica del cliente de WhatsApp Web. whatsapp-web.js se carga aquí y no al importar el
 * módulo, así las pruebas del servicio no necesitan puppeteer.
 *
 * El cliente agrega dos operaciones que usa la sesión: listarGrupos() y enviarTexto().
 */
function crearFabricaCliente({ authDir, chromeBin }) {
  const ejecutable = navegador(chromeBin);
  console.log(`[WhatsApp] Navegador: ${ejecutable ?? 'el descargado por puppeteer'}`);
  return () => {
    const { Client, LocalAuth } = require('whatsapp-web.js');
    const args = ['--disable-dev-shm-usage', '--disable-gpu', '--no-first-run'];
    // Chrome no admite su sandbox ejecutándose como root (contenedores, algunos servidores Linux).
    if (process.getuid?.() === 0) args.push('--no-sandbox', '--disable-setuid-sandbox');
    const cliente = new Client({
      authStrategy: new LocalAuth({ dataPath: authDir }),
      puppeteer: { headless: true, executablePath: ejecutable, args }
    });
    cliente.listarGrupos = () => cliente.pupPage.evaluate(gruposEnLaPagina);
    // sendMessage busca el chat sin serializarlo (a diferencia de getChatById). sendSeen marcaría el
    // grupo como leído en el teléfono de la Junta, algo que no hace falta para publicar.
    // waitUntilMsgSent espera la respuesta de WhatsApp: si el envío falla, la promesa se rechaza.
    // Aun así puede resolver sin el mensaje (en grupos no siempre lo encuentra por su clave).
    cliente.enviarTexto = (chatId, texto) => cliente.sendMessage(chatId, texto, { sendSeen: false, waitUntilMsgSent: true });
    return cliente;
  };
}

module.exports = { crearFabricaCliente, navegador, gruposEnLaPagina };
