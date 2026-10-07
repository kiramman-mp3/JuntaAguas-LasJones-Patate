const env = require('./config/env');
const db = require('./config/db');
const app = require('./app');

const server = app.listen(env.PORT, () => {
  console.log(`[Servidor Backend] http://localhost:${env.PORT}/api (${env.NODE_ENV})`);
  if (!env.esProduccion) console.log(`[Swagger UI] http://localhost:${env.PORT}/api-docs`);
});

// Cierre ordenado: deja de aceptar conexiones, termina las peticiones en curso y libera el pool.
let cerrando = false;
async function apagar(senal) {
  if (cerrando) return;
  cerrando = true;
  console.log(`[Servidor Backend] ${senal} recibido, cerrando...`);
  const forzar = setTimeout(() => process.exit(1), 10000);
  forzar.unref();
  server.close(async () => {
    try {
      await require('./services/whatsappService').cerrar?.();
    } catch { /* el servicio puede no estar inicializado */ }
    await db.end().catch(() => {});
    process.exit(0);
  });
}

process.on('SIGINT', () => apagar('SIGINT'));
process.on('SIGTERM', () => apagar('SIGTERM'));
process.on('unhandledRejection', (razon) => {
  console.error('[Promesa rechazada sin manejar]', razon);
});
