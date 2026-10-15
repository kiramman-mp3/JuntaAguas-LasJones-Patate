#!/usr/bin/env node
/**
 * Lanzador de desarrollo y presentación interactiva:
 *
 *   npm run dev
 *
 * Inicia de forma coordinada el backend (puerto 3000) y el frontend de Angular (puerto 4200).
 * Si la base de datos no está levantada, intenta iniciar el contenedor con Docker Compose.
 * Al detener el script (Ctrl+C), todos los subprocesos se cierran de manera limpia.
 */
const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const raiz = path.join(__dirname, '..');
const backend = path.join(raiz, 'backend');
const frontend = path.join(raiz, 'frontend');
const whatsappService = path.join(raiz, 'whatsapp-service');
const bd = path.join(raiz, 'bd');

console.log('\x1b[1;36m============================================================\x1b[0m');
console.log('\x1b[1;36m  Junta de Agua y Riego "La Jones" (Patate) - Demo Runner   \x1b[0m');
console.log('\x1b[1;36m============================================================\x1b[0m\n');

// 1. Verificar Node.js
const [mayor, menor, parche] = process.versions.node.split('.').map(Number);
const nodeValido = mayor >= 26 || (mayor === 24 && menor >= 15) || (mayor === 22 && (menor > 22 || (menor === 22 && parche >= 3)));
if (!nodeValido) {
  console.error(`\x1b[31m[error] Se requiere Node.js 22.22.3+, 24.15+ o 26+ (actual: ${process.versions.node}).\x1b[0m`);
  process.exit(1);
}

// 2. Verificar base de datos (Docker)
const composeFile = path.join(bd, 'docker-compose.yml');
if (fs.existsSync(composeFile)) {
  const check = spawnSync('docker', ['ps', '--filter', 'name=junta_las_jones_mysql', '--format', '{{.Status}}'], { shell: process.platform === 'win32' });
  const statusStr = (check.stdout || '').toString().trim();
  if (!statusStr.includes('Up')) {
    console.log('\x1b[33m[bd] Iniciando contenedor MySQL de desarrollo...\x1b[0m');
    const up = spawnSync('docker', ['compose', '-f', 'docker-compose.yml', 'up', '-d'], { cwd: bd, stdio: 'inherit', shell: process.platform === 'win32' });
    if (up.status !== 0) {
      console.warn('\x1b[33m[aviso] No se pudo iniciar el contenedor con docker compose. Asegúrese de que MySQL esté activo en el puerto 3306.\x1b[0m');
    }
  } else {
    console.log('\x1b[32m[bd] Contenedor MySQL activo.\x1b[0m');
  }
}

// 3. Iniciar Backend y Frontend
const hijos = [];

function prefijar(nombre, colorCode, corriente, salida) {
  let remanente = '';
  corriente.on('data', (datos) => {
    const texto = remanente + datos.toString();
    const lineas = texto.split('\n');
    remanente = lineas.pop();
    for (const linea of lineas) {
      salida.write(`\x1b[${colorCode}m[${nombre}]\x1b[0m ${linea}\n`);
    }
  });
  corriente.on('end', () => {
    if (remanente) salida.write(`\x1b[${colorCode}m[${nombre}]\x1b[0m ${remanente}\n`);
  });
}

function iniciarServicio(nombre, colorCode, comando, args, cwd) {
  const p = spawn(comando, args, {
    cwd,
    shell: process.platform === 'win32',
    stdio: ['inherit', 'pipe', 'pipe']
  });

  prefijar(nombre, colorCode, p.stdout, process.stdout);
  prefijar(nombre, colorCode, p.stderr, process.stderr);

  p.on('error', (err) => {
    console.error(`\x1b[31m[${nombre}] Error al iniciar: ${err.message}\x1b[0m`);
  });

  p.on('exit', (codigo, senal) => {
    console.log(`\x1b[${colorCode}m[${nombre}]\x1b[0m Finalizó con código ${codigo ?? senal}`);
  });

  hijos.push(p);
  return p;
}

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

console.log('\x1b[1;32m[1/2] Iniciando Backend API (Express en puerto 3000)...\x1b[0m');
iniciarServicio('backend', '34', npmCmd, ['run', 'dev'], backend);

console.log('\x1b[1;35m[2/2] Iniciando Frontend (Angular en puerto 4200)...\x1b[0m');
iniciarServicio('frontend', '35', npmCmd, ['start'], frontend);

// Servicio de WhatsApp opcional
if (process.argv.includes('--whatsapp') && fs.existsSync(path.join(whatsappService, '.env'))) {
  console.log('\x1b[1;32m[+] Iniciando Servicio WhatsApp (puerto 3100)...\x1b[0m');
  iniciarServicio('whatsapp', '32', npmCmd, ['run', 'dev'], whatsappService);
}

// 4. Imprimir credenciales y accesos de demostración
setTimeout(() => {
  console.log('\n\x1b[1;32m✓ Entorno de presentación listo:\x1b[0m');
  console.log('  ─────────────────────────────────────────────────────────────');
  console.log('  \x1b[1mPortal Web (Frontend):\x1b[0m    http://localhost:4200');
  console.log('  \x1b[1mAPI & Backend:\x1b[0m            http://localhost:3000');
  console.log('  \x1b[1mDocumentación Swagger:\x1b[0m    http://localhost:3000/api-docs');
  console.log('  ─────────────────────────────────────────────────────────────');
  console.log('  \x1b[1;33mCredenciales para la demostración:\x1b[0m');
  console.log('  • \x1b[1mAdministrador (Presidente):\x1b[0m  1823661267 (Carlos Moreta)');
  console.log('  • \x1b[1mComunero (Usuario):\x1b[0m          1809198243 (Beatriz Viteri)');
  console.log('  • \x1b[1mContraseña común:\x1b[0m            Junta2026');
  console.log('  ─────────────────────────────────────────────────────────────');
  console.log('  \x1b[90mPresione Ctrl+C para detener todos los servicios.\x1b[0m\n');
}, 3000);

// Limpieza de procesos al salir
function terminar() {
  console.log('\n\x1b[33mDeteniendo servicios...\x1b[0m');
  for (const h of hijos) {
    if (process.platform === 'win32' && h.pid) {
      try {
        spawnSync('taskkill', ['/pid', h.pid.toString(), '/t', '/f']);
      } catch {}
    } else {
      h.kill('SIGTERM');
    }
  }
  process.exit(0);
}

process.on('SIGINT', terminar);
process.on('SIGTERM', terminar);
