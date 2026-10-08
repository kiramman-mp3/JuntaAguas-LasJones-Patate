const fs = require('fs');

const NAVEGADORES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  process.env.LOCALAPPDATA ? `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe` : null,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
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
  return () => {
    const { Client, LocalAuth } = require('whatsapp-web.js');
    const args = ['--disable-dev-shm-usage', '--disable-gpu', '--no-first-run'];
    // Chrome no admite su sandbox ejecutándose como root (contenedores, algunos servidores Linux).
    if (process.getuid?.() === 0) args.push('--no-sandbox', '--disable-setuid-sandbox');
    return new Client({
      authStrategy: new LocalAuth({ dataPath: authDir }),
      puppeteer: { headless: true, executablePath: navegador(chromeBin), args }
    });
  };
}

module.exports = { crearFabricaCliente };
