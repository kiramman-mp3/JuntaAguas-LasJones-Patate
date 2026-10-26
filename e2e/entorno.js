const path = require('path');

const PUERTO = Number(process.env.E2E_PUERTO || 3210);
// Base propia: nunca se toca la de desarrollo. El seed con --reset la recrea en cada ejecución.
const DB_NAME = 'junta_las_jones_e2e';
const PASSWORD = 'E2eJunta2026';
// Servicio de WhatsApp simulado (ver whatsapp-simulado.js) y su token compartido con el backend.
const PUERTO_WHATSAPP = Number(process.env.E2E_PUERTO_WHATSAPP || 3199);
const TOKEN_WHATSAPP = 'e2e-token-whatsapp-0123456789abcdef0123456789';

module.exports = {
  PUERTO,
  PUERTO_WHATSAPP,
  TOKEN_WHATSAPP,
  DB_NAME,
  PASSWORD,
  RAIZ: path.join(__dirname, '..'),
  ARCHIVO_SESION: path.join(__dirname, '.auth', 'admin.json'),
  ARCHIVO_CREDENCIALES: path.join(__dirname, '.auth', 'credenciales.json')
};
