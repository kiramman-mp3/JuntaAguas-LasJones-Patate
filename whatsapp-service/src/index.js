const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode');
const { leerConfiguracion } = require('./config');
const { SesionWhatsApp } = require('./sesion');
const { crearFabricaCliente } = require('./cliente');
const { crearApp } = require('./app');

const config = leerConfiguracion();
const sesion = new SesionWhatsApp({
  crearCliente: crearFabricaCliente(config),
  generarQr: (texto) => qrcode.toDataURL(texto)
});

const servidor = crearApp({ sesion, token: config.token }).listen(config.puerto, config.host, () => {
  console.log(`[WhatsApp] Servicio escuchando en http://${config.host}:${config.puerto}`);
  // Si el teléfono ya estaba vinculado, se reconecta solo para que las convocatorias funcionen tras un reinicio.
  if (fs.existsSync(path.join(config.authDir, 'session'))) sesion.iniciar();
});

let cerrando = false;
function apagar(senal) {
  if (cerrando) return;
  cerrando = true;
  console.log(`[WhatsApp] ${senal} recibido, cerrando...`);
  setTimeout(() => process.exit(1), 10000).unref();
  servidor.close(async () => {
    await sesion.detener();
    process.exit(0);
  });
}

process.on('SIGINT', () => apagar('SIGINT'));
process.on('SIGTERM', () => apagar('SIGTERM'));
process.on('unhandledRejection', (razon) => console.error('[WhatsApp] Promesa rechazada sin manejar:', razon));
