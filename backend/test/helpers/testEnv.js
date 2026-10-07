/**
 * Entorno de pruebas de integración. Debe requerirse ANTES que cualquier módulo de src/.
 * Usa una base de datos dedicada (por defecto junta_las_jones_test) que se recrea en cada archivo de prueba.
 */
const os = require('os');
const path = require('path');
const fs = require('fs');

process.env.NODE_ENV = 'test';
process.env.DB_NAME = process.env.TEST_DB_NAME || 'junta_las_jones_test';
process.env.JWT_SECRET = 'secreto-exclusivo-de-pruebas-0123456789abcdef';
process.env.UPLOADS_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'junta-uploads-'));

if (!/_test$/.test(process.env.DB_NAME)) {
  throw new Error('Las pruebas solo pueden ejecutarse contra una base cuyo nombre termine en _test.');
}

const { conectarServidor, conectarBase } = require('../../src/db/connection');
const { migrate } = require('../../src/db/migrator');

/** Elimina y recrea la base de pruebas con todas las migraciones aplicadas. */
async function resetDatabase() {
  const servidor = await conectarServidor();
  await servidor.query(`DROP DATABASE IF EXISTS \`${process.env.DB_NAME}\``);
  await servidor.end();
  const conexion = await conectarBase(process.env.DB_NAME);
  await migrate(conexion, { log: () => {} });
  await conexion.end();
}

/** Cierra el pool compartido de la aplicación para que el proceso de pruebas termine. */
async function closeDatabase() {
  await require('../../src/config/db').end();
}

module.exports = { resetDatabase, closeDatabase };
