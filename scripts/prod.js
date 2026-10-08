#!/usr/bin/env node
/**
 * Despliegue de producción con una base de datos limpia:
 *
 *   npm run prod                 verifica, instala, compila, prepara la base e inicia los servidores
 *   npm run prod -- --preparar   lo mismo, sin iniciar los servidores (para usar pm2, systemd, etc.)
 *   npm run prod -- --instalar   fuerza reinstalar las dependencias (npm ci)
 *
 * La base se crea si no existe y recibe solo lo necesario para operar: catálogos (roles y conceptos
 * de cobro) y el primer administrador. No siembra datos de prueba ni borra datos: repetir el comando
 * en una base que ya está en uso solo aplica las migraciones pendientes.
 *
 * El servicio de WhatsApp (whatsapp-service/) es opcional: se inicia junto al backend si existe
 * whatsapp-service/.env. Si se detiene, el backend sigue funcionando sin convocatorias por WhatsApp.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync, spawn } = require('child_process');

const raiz = path.join(__dirname, '..');
const backend = path.join(raiz, 'backend');
const frontend = path.join(raiz, 'frontend');
const whatsappService = path.join(raiz, 'whatsapp-service');
const conWhatsApp = fs.existsSync(path.join(whatsappService, '.env'));
const flags = new Set(process.argv.slice(2));

const paso = (n, texto) => console.log(`\n\x1b[1m[prod ${n}/5]\x1b[0m ${texto}`);
const fallar = (mensaje) => {
  console.error(`\n\x1b[31m[prod] ${mensaje}\x1b[0m`);
  process.exit(1);
};

function ejecutar(comando, args, cwd) {
  const r = spawnSync(comando, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) fallar(`Falló: ${comando} ${args.join(' ')} (en ${path.relative(raiz, cwd) || '.'})`);
}

// 1. Requisitos y configuración ------------------------------------------------------------
paso(1, 'Verificando requisitos y configuración');
// Mismo rango que exige Angular 22: ^22.22.3 || ^24.15.0 || >=26.
const [mayor, menor, parche] = process.versions.node.split('.').map(Number);
const nodeValido = mayor >= 26 || (mayor === 24 && menor >= 15) || (mayor === 22 && (menor > 22 || (menor === 22 && parche >= 3)));
if (!nodeValido) fallar(`Se requiere Node.js 22.22.3+, 24.15+ o 26+ (actual: ${process.versions.node}).`);

const archivoEnv = path.join(backend, '.env');
if (!fs.existsSync(archivoEnv)) {
  fallar('Falta backend/.env. Copie backend/.env.production.example como backend/.env y complete sus valores.');
}

// 2. Dependencias --------------------------------------------------------------------------
paso(2, 'Instalando dependencias');
for (const dir of [backend, frontend, ...(conWhatsApp ? [whatsappService] : [])]) {
  if (flags.has('--instalar') || !fs.existsSync(path.join(dir, 'node_modules'))) ejecutar('npm', ['ci'], dir);
  else console.log(`  ${path.basename(dir)}: dependencias ya instaladas (use --instalar para reinstalar).`);
}

// Con las dependencias instaladas ya se puede validar backend/.env con el mismo esquema del servidor.
let env;
try {
  env = require(path.join(backend, 'src/config/env.js'));
} catch (error) {
  fallar(error.message);
}
const problemas = [];
if (env.NODE_ENV !== 'production') problemas.push('NODE_ENV debe ser "production" en backend/.env.');
if (!env.DB_PASSWORD || ['rootpassword', 'junta_password', 'root'].includes(env.DB_PASSWORD)) {
  problemas.push('DB_PASSWORD está vacía o usa la contraseña de ejemplo de bd/docker-compose.yml.');
}
if (env.DB_USER === 'root') console.warn('  Aviso: se recomienda un usuario de base de datos propio en lugar de root.');
if (conWhatsApp) {
  try {
    const whatsapp = require(path.join(whatsappService, 'src/config.js')).leerConfiguracion();
    if (whatsapp.token !== env.WHATSAPP_SERVICE_TOKEN) {
      problemas.push('WHATSAPP_SERVICE_TOKEN debe ser el mismo en backend/.env y whatsapp-service/.env.');
    }
  } catch (error) {
    problemas.push(error.message);
  }
} else {
  console.warn('  Aviso: no existe whatsapp-service/.env; las convocatorias por WhatsApp quedan deshabilitadas.');
}
if (problemas.length) fallar(`Configuración no apta para producción:\n  - ${problemas.join('\n  - ')}`);
console.log(`  Base de datos: ${env.DB_USER}@${env.DB_HOST}:${env.DB_PORT}/${env.DB_NAME} · puerto HTTP ${env.PORT}`);

// 3. Frontend ------------------------------------------------------------------------------
paso(3, 'Compilando el frontend (producción)');
ejecutar('npm', ['run', 'build'], frontend);
if (!fs.existsSync(path.join(env.FRONTEND_DIST, 'index.html'))) {
  fallar(`No se encontró el frontend compilado en ${env.FRONTEND_DIST}.`);
}

// 4. Base de datos -------------------------------------------------------------------------
paso(4, 'Preparando la base de datos (migraciones y administrador inicial)');
ejecutar('npm', ['run', 'db:setup'], backend);
fs.mkdirSync(env.UPLOADS_DIR, { recursive: true });

// 5. Servidor ------------------------------------------------------------------------------
if (flags.has('--preparar')) {
  paso(5, `Listo. Inicie el servidor con: npm start${conWhatsApp ? ' (y el de WhatsApp con: npm run start:whatsapp)' : ''}`);
  process.exit(0);
}
paso(5, `Iniciando el servidor en http://localhost:${env.PORT}`);
console.log('  Recuerde: en Ajustes → Tarifas registre la cuota de agua y las multas de asamblea y minga,');
console.log('  y en Comuneros → Catastro cree los sectores antes de registrar lotes.\n');
const whatsapp = conWhatsApp ? spawn(process.execPath, ['src/index.js'], { cwd: whatsappService, stdio: 'inherit' }) : null;
whatsapp?.on('exit', (codigo) => {
  if (codigo) console.warn(`
[prod] El servicio de WhatsApp se detuvo (código ${codigo}). El sistema sigue funcionando sin WhatsApp.`);
});
const servidor = spawn(process.execPath, ['src/index.js'], { cwd: backend, stdio: 'inherit' });
for (const senal of ['SIGINT', 'SIGTERM']) {
  process.on(senal, () => {
    whatsapp?.kill(senal);
    servidor.kill(senal);
  });
}
servidor.on('exit', (codigo) => {
  whatsapp?.kill('SIGTERM');
  process.exit(codigo ?? 0);
});
