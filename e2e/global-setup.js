const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { PUERTO, DB_NAME, PASSWORD, RAIZ, ARCHIVO_CREDENCIALES } = require('./entorno');

const backend = path.join(RAIZ, 'backend');
const entorno = {
  ...process.env,
  NODE_ENV: 'development',
  PORT: String(PUERTO),
  HOST: '127.0.0.1',
  DB_NAME,
  JWT_SECRET: 'e2e-secreto-solo-para-pruebas-0123456789abcdef',
  SEED_PASSWORD: PASSWORD,
  LOG_LEVEL: 'warn',
  // El servicio de WhatsApp no corre en las pruebas: las convocatorias quedan deshabilitadas.
  WHATSAPP_SERVICE_TOKEN: ''
};

async function esperarSalud(url, intentos = 60) {
  for (let i = 0; i < intentos; i += 1) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {
      // el servidor aún no escucha
    }
    await new Promise((resolver) => setTimeout(resolver, 500));
  }
  throw new Error(`El backend no respondió en ${url}`);
}

module.exports = async function globalSetup() {
  if (!fs.existsSync(path.join(RAIZ, 'frontend/dist/frontend/browser/index.html'))) {
    throw new Error('Falta el frontend compilado. Ejecute: npm --prefix frontend run build');
  }

  // Base limpia y sembrada con datos realistas (nunca la de desarrollo: DB_NAME es fijo).
  const seed = spawnSync('node', ['src/db/cli.js', 'seed', '--reset'], { cwd: backend, env: entorno, encoding: 'utf8' });
  if (seed.status !== 0) throw new Error(`Falló el seed de la base E2E:\n${seed.stdout}\n${seed.stderr}`);
  const admin = /Administrador:\s+(\d+)\s+\((.+)\)/.exec(seed.stdout);
  const usuario = /Usuario:\s+(\d+)\s+\((.+)\)/.exec(seed.stdout);
  if (!admin || !usuario) throw new Error(`No se pudieron leer las credenciales del seed:\n${seed.stdout}`);
  fs.mkdirSync(path.dirname(ARCHIVO_CREDENCIALES), { recursive: true });
  // El estado compartido entre archivos pertenece a la base anterior, que acaba de recrearse.
  fs.rmSync(path.join(path.dirname(ARCHIVO_CREDENCIALES), 'estado.json'), { force: true });
  fs.writeFileSync(ARCHIVO_CREDENCIALES, JSON.stringify({
    password: PASSWORD,
    admin: { cedula: admin[1], nombre: admin[2] },
    usuario: { cedula: usuario[1], nombre: usuario[2] }
  }, null, 2));

  const servidor = spawn('node', ['src/index.js'], { cwd: backend, env: entorno, stdio: ['ignore', 'inherit', 'inherit'] });
  await esperarSalud(`http://127.0.0.1:${PUERTO}/api/health`);

  return async () => {
    servidor.kill('SIGTERM');
  };
};
