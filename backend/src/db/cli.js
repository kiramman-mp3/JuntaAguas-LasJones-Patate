#!/usr/bin/env node
/**
 * Tareas de base de datos:
 *   node src/db/cli.js migrate          Aplica migraciones pendientes (crea la base si no existe).
 *   node src/db/cli.js drop --yes       Elimina la base de datos (solo fuera de producción).
 */
const env = require('../config/env');
const { conectarServidor, conectarBase } = require('./connection');
const { migrate } = require('./migrator');

async function main() {
  const [comando, ...flags] = process.argv.slice(2);

  if (comando === 'migrate') {
    const conexion = await conectarBase();
    try {
      await migrate(conexion);
    } finally {
      await conexion.end();
    }
    return;
  }

  if (comando === 'drop') {
    if (env.esProduccion) throw new Error('No se permite eliminar la base de datos en producción.');
    if (!flags.includes('--yes')) {
      throw new Error(`Esta acción elimina la base '${env.DB_NAME}' por completo. Repite el comando con --yes para confirmar.`);
    }
    const conexion = await conectarServidor();
    try {
      await conexion.query(`DROP DATABASE IF EXISTS \`${env.DB_NAME}\``);
      console.log(`[db] Base de datos '${env.DB_NAME}' eliminada.`);
    } finally {
      await conexion.end();
    }
    return;
  }

  throw new Error('Uso: node src/db/cli.js <migrate|drop --yes>');
}

main().catch((error) => {
  console.error(`[db] ${error.message}`);
  process.exit(1);
});
