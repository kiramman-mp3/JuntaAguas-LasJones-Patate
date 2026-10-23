const fs = require('fs');
const path = require('path');

const MIGRATIONS_DIR = path.join(__dirname, '../../database/migrations');

/**
 * Migraciones renombradas para que cada número sea único (nombre anterior -> nombre actual).
 * schema_migrations guarda el nombre del archivo: sin este mapa, una base que ya las aplicó
 * con el nombre anterior las ejecutaría de nuevo.
 */
const MIGRACIONES_RENOMBRADAS = Object.freeze({
  '011_pago_comprobante.js': '015_pago_comprobante.js',
  '014_terminologia_usuarios.js': '016_terminologia_usuarios.js'
});

async function columnExists(db, tabla, columna) {
  const [rows] = await db.query(
    'SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
    [tabla, columna]
  );
  return rows.length > 0;
}

async function addColumnIfMissing(db, tabla, columna, definicion) {
  if (!(await columnExists(db, tabla, columna))) {
    await db.query(`ALTER TABLE \`${tabla}\` ADD COLUMN \`${columna}\` ${definicion}`);
  }
}

async function dropColumnIfExists(db, tabla, columna) {
  if (await columnExists(db, tabla, columna)) {
    await db.query(`ALTER TABLE \`${tabla}\` DROP COLUMN \`${columna}\``);
  }
}

async function addIndexIfMissing(db, tabla, indice, columnas) {
  const [rows] = await db.query(
    'SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?',
    [tabla, indice]
  );
  if (!rows.length) await db.query(`ALTER TABLE \`${tabla}\` ADD INDEX \`${indice}\` ${columnas}`);
}

async function addUniqueIfMissing(db, tabla, indice, columnas) {
  const [rows] = await db.query(
    'SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?',
    [tabla, indice]
  );
  if (!rows.length) await db.query(`ALTER TABLE \`${tabla}\` ADD UNIQUE KEY \`${indice}\` ${columnas}`);
}

const helpers = { columnExists, addColumnIfMissing, dropColumnIfExists, addIndexIfMissing, addUniqueIfMissing };

/** Divide un script SQL en sentencias, ignorando comentarios de línea. */
function sentenciasSql(script) {
  return script
    .split('\n')
    .filter((linea) => !linea.trim().startsWith('--'))
    .join('\n')
    .split(/;\s*(?:\r?\n|$)/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function listarMigraciones() {
  return fs.readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d{3}_[\w-]+\.(sql|js)$/.test(f))
    .sort();
}

/**
 * Aplica en orden las migraciones pendientes y las registra en schema_migrations.
 * @param {import('mysql2/promise').Connection} db conexión ya posicionada en la base de datos
 */
async function migrate(db, { log = console.log } = {}) {
  await db.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    id VARCHAR(150) PRIMARY KEY,
    applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB`);

  const [aplicadas] = await db.query('SELECT id FROM schema_migrations');
  const hechas = new Set(aplicadas.map((r) => r.id));
  for (const [anterior, actual] of Object.entries(MIGRACIONES_RENOMBRADAS)) {
    if (!hechas.has(anterior)) continue;
    if (hechas.has(actual)) await db.query('DELETE FROM schema_migrations WHERE id = ?', [anterior]);
    else await db.query('UPDATE schema_migrations SET id = ? WHERE id = ?', [actual, anterior]);
    hechas.delete(anterior);
    hechas.add(actual);
  }
  const pendientes = listarMigraciones().filter((f) => !hechas.has(f));

  for (const archivo of pendientes) {
    const ruta = path.join(MIGRATIONS_DIR, archivo);
    log(`[migrate] Aplicando ${archivo}`);
    if (archivo.endsWith('.sql')) {
      for (const sentencia of sentenciasSql(fs.readFileSync(ruta, 'utf8'))) {
        await db.query(sentencia);
      }
    } else {
      await require(ruta).up(db, helpers);
    }
    await db.query('INSERT INTO schema_migrations (id) VALUES (?)', [archivo]);
  }

  if (!pendientes.length) log('[migrate] La base de datos ya está al día.');
  return pendientes;
}

module.exports = { migrate, listarMigraciones, helpers, MIGRACIONES_RENOMBRADAS };
