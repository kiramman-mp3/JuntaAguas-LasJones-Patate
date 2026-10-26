const env = require('./config/env');
const db = require('./config/db');
const app = require('./app');
const logger = require('./shared/logger');

const server = app.listen(env.PORT, env.HOST, () => {
  logger.info('servidor iniciado', { url: `http://${env.HOST}:${env.PORT}/api`, entorno: env.NODE_ENV });
  if (!env.esProduccion) logger.info('documentación Swagger', { url: `http://localhost:${env.PORT}/api-docs` });
});

// Cierre ordenado: deja de aceptar conexiones, termina las peticiones en curso y libera el pool.
let cerrando = false;
async function apagar(senal, codigo = 0) {
  if (cerrando) return;
  cerrando = true;
  logger.info('cerrando servidor', { senal });
  const forzar = setTimeout(() => process.exit(1), 10000);
  forzar.unref();
  server.close(async () => {
    await db.end().catch(() => {});
    process.exit(codigo);
  });
}

process.on('SIGINT', () => apagar('SIGINT'));
process.on('SIGTERM', () => apagar('SIGTERM'));
process.on('unhandledRejection', (razon) => {
  logger.error('promesa rechazada sin manejar', { err: razon });
});
// Tras una excepción no capturada el estado del proceso es incierto: se registra, se cierra
// ordenadamente y se sale con error para que systemd, pm2 o Docker lo reinicien.
process.on('uncaughtException', (error) => {
  logger.error('excepción no capturada', { err: error });
  apagar('uncaughtException', 1);
});
