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
 * Fábrica del cliente de WhatsApp Web. whatsapp-web.js se carga aquí y no al importar el
 * módulo, así las pruebas del servicio no necesitan puppeteer.
 */
function crearFabricaCliente({ authDir, chromeBin }) {
  const ejecutable = navegador(chromeBin);
  console.log(`[WhatsApp] Navegador: ${ejecutable ?? 'el descargado por puppeteer'}`);
  return () => {
    const { Client, LocalAuth } = require('whatsapp-web.js');
    const args = ['--disable-dev-shm-usage', '--disable-gpu', '--no-first-run'];
    // Chrome no admite su sandbox ejecutándose como root (contenedores, algunos servidores Linux).
    if (process.getuid?.() === 0) args.push('--no-sandbox', '--disable-setuid-sandbox');
    return new Client({
      authStrategy: new LocalAuth({ dataPath: authDir }),
      puppeteer: { headless: true, executablePath: ejecutable, args }
    });
  };
}

module.exports = { crearFabricaCliente, navegador };
