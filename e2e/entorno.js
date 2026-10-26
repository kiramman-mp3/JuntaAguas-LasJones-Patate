const path = require('path');

const PUERTO = Number(process.env.E2E_PUERTO || 3210);
// Base propia: nunca se toca la de desarrollo. El seed con --reset la recrea en cada ejecución.
const DB_NAME = 'junta_las_jones_e2e';
const PASSWORD = 'E2eJunta2026';

module.exports = {
  PUERTO,
  DB_NAME,
  PASSWORD,
  RAIZ: path.join(__dirname, '..'),
  ARCHIVO_SESION: path.join(__dirname, '.auth', 'admin.json'),
  ARCHIVO_CREDENCIALES: path.join(__dirname, '.auth', 'credenciales.json')
};
