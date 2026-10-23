const { resetDatabase, closeDatabase } = require('../helpers/testEnv');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const app = require('../../src/app');
const db = require('../../src/config/db');
const { migrate, listarMigraciones, MIGRACIONES_RENOMBRADAS } = require('../../src/db/migrator');
const { crearPersona } = require('../helpers/fixtures');

before(resetDatabase);
after(closeDatabase);

test('todas las migraciones quedan registradas y una segunda ejecución no hace nada', async () => {
  const [registradas] = await db.query('SELECT id FROM schema_migrations ORDER BY id');
  assert.deepEqual(registradas.map((r) => r.id), listarMigraciones());

  const conexion = await db.getConnection();
  try {
    const aplicadas = await migrate(conexion, { log: () => {} });
    assert.deepEqual(aplicadas, []);
  } finally {
    conexion.release();
  }
});

test('cada migración tiene un número único', () => {
  const numeros = listarMigraciones().map((archivo) => archivo.slice(0, 3));
  const repetidos = numeros.filter((numero, i) => numeros.indexOf(numero) !== i);
  assert.deepEqual([...new Set(repetidos)], []);
});

test('una base con los nombres anteriores de las migraciones renombradas no las vuelve a ejecutar', async () => {
  for (const [anterior, actual] of Object.entries(MIGRACIONES_RENOMBRADAS)) {
    assert.ok(listarMigraciones().includes(actual), `falta el archivo ${actual}`);
    await db.query('UPDATE schema_migrations SET id = ? WHERE id = ?', [anterior, actual]);
  }

  const conexion = await db.getConnection();
  try {
    assert.deepEqual(await migrate(conexion, { log: () => {} }), []);
  } finally {
    conexion.release();
  }
  const [registradas] = await db.query('SELECT id FROM schema_migrations ORDER BY id');
  assert.deepEqual(registradas.map((r) => r.id), listarMigraciones());
});

test('la migración de pagos anuales de agua adapta las tablas creadas a mano con el script inicial', async () => {
  await db.query('DROP TABLE pago_anual_agua_detalle');
  await db.query('DROP TABLE pago_anual_agua');
  await db.query('DROP TABLE obligacion_anual_agua');
  await db.query("DELETE FROM schema_migrations WHERE id = '017_pagos_anuales_agua.js'");
  await db.query(`CREATE TABLE obligacion_anual_agua (
    id BIGINT AUTO_INCREMENT PRIMARY KEY, persona_id BIGINT NOT NULL, periodo_anio SMALLINT,
    valor_total DECIMAL(12, 2) NOT NULL, estado ENUM('PENDIENTE', 'PAGADO') NOT NULL DEFAULT 'PENDIENTE',
    FOREIGN KEY (persona_id) REFERENCES personas(id) ON DELETE CASCADE) ENGINE=InnoDB`);
  await db.query(`CREATE TABLE pago_anual_agua (
    id BIGINT AUTO_INCREMENT PRIMARY KEY, persona_id BIGINT NOT NULL, valor_total DECIMAL(12, 2) NOT NULL,
    metodo ENUM('TRANSFERENCIA', 'DEPOSITO') NOT NULL DEFAULT 'TRANSFERENCIA', referencia VARCHAR(100), observacion VARCHAR(255),
    fecha_pago DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (persona_id) REFERENCES personas(id) ON DELETE CASCADE) ENGINE=InnoDB`);
  await db.query(`CREATE TABLE pago_anual_agua_detalle (
    id BIGINT AUTO_INCREMENT PRIMARY KEY, pago_anual_agua_id BIGINT NOT NULL, obligacion_anual_agua BIGINT NOT NULL,
    FOREIGN KEY (pago_anual_agua_id) REFERENCES pago_anual_agua(id) ON DELETE CASCADE,
    FOREIGN KEY (obligacion_anual_agua) REFERENCES obligacion_anual_agua(id) ON DELETE CASCADE) ENGINE=InnoDB`);

  const { personaId: id } = await crearPersona();
  await db.query(
    "INSERT INTO obligacion_anual_agua (persona_id, periodo_anio, valor_total) VALUES (?, 2026, 10), (?, 2026, 10), (?, 2025, 10)",
    [id, id, id]
  );

  const conexion = await db.getConnection();
  try {
    assert.deepEqual(await migrate(conexion, { log: () => {} }), ['017_pagos_anuales_agua.js']);
  } finally {
    conexion.release();
  }

  const [[{ total }]] = await db.query('SELECT COUNT(*) AS total FROM obligacion_anual_agua WHERE persona_id = ?', [id]);
  assert.equal(total, 2, 'se descartan las obligaciones repetidas sin pagar');
  const [indices] = await db.query(
    "SELECT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND INDEX_NAME IN ('uq_obligacion_anual_persona_anio', 'uq_pago_anual_detalle_obligacion')"
  );
  assert.equal(indices.length, 3, 'unicidad por usuario y año (2 columnas) y por obligación pagada');
  const [[columna]] = await db.query(
    "SELECT IS_NULLABLE AS nulo FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'obligacion_anual_agua' AND COLUMN_NAME = 'periodo_anio'"
  );
  assert.equal(columna.nulo, 'NO');
  const [registro] = await db.query(
    "SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pago_anual_agua' AND COLUMN_NAME = 'registrado_por_cuenta_id'"
  );
  assert.equal(registro.length, 1);
});

test('la migración del grupo de WhatsApp se puede repetir y admite envíos sin persona', async () => {
  const { helpers } = require('../../src/db/migrator');
  const migracion = require('../../database/migrations/012_whatsapp_grupo_convocatorias');
  const conexion = await db.getConnection();
  try {
    await migracion.up(conexion, helpers);
  } finally {
    conexion.release();
  }
  const [[columna]] = await db.query(
    "SELECT IS_NULLABLE AS nulo FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'envios_convocatoria' AND COLUMN_NAME = 'persona_id'"
  );
  assert.equal(columna.nulo, 'YES');
  const [tablas] = await db.query("SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'configuracion'");
  assert.equal(tablas.length, 1);
});

test('el esquema incluye las columnas que usa el código', async () => {
  const [columnas] = await db.query(`SELECT TABLE_NAME AS t, COLUMN_NAME AS c FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()`);
  const existe = (t, c) => columnas.some((x) => x.t === t && x.c === c);
  for (const c of ['titulo_acta', 'estado_acta', 'acta_firmada_url', 'responsables', 'fecha_acta']) {
    assert.ok(existe('puntos_asamblea', c), `falta puntos_asamblea.${c}`);
  }
  for (const c of ['estado', 'anulado_por_cuenta_id', 'fecha_anulacion', 'motivo_anulacion']) {
    assert.ok(existe('pagos', c), `falta pagos.${c}`);
  }
  assert.ok(!existe('documentos_evento', 'contenido_base64'));
});

test('solo existen los roles ADMIN y USUARIO', async () => {
  const [roles] = await db.query('SELECT codigo FROM roles ORDER BY codigo');
  assert.deepEqual(roles.map((r) => r.codigo), ['ADMIN', 'USUARIO']);
});

test('health comprueba la base de datos', async () => {
  const res = await request(app).get('/api/health');
  assert.equal(res.status, 200);
  assert.equal(res.body.database, 'OK');
});

test('rutas inexistentes devuelven 404 JSON', async () => {
  const res = await request(app).get('/api/no-existe');
  assert.equal(res.status, 404);
  assert.equal(res.body.status, 'ERROR');
});

test('un JSON mal formado devuelve 400 sin detalles internos', async () => {
  const res = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{"cedula":');
  assert.equal(res.status, 400);
  assert.equal(res.body.message, 'El cuerpo de la solicitud no es un JSON válido.');
});

test('incluye cabeceras de seguridad', async () => {
  const res = await request(app).get('/api/health');
  assert.equal(res.headers['x-content-type-options'], 'nosniff');
  assert.equal(res.headers['x-powered-by'], undefined);
});
