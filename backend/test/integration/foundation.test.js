const { resetDatabase, closeDatabase } = require('../helpers/testEnv');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const app = require('../../src/app');
const db = require('../../src/config/db');
const { migrate, listarMigraciones } = require('../../src/db/migrator');

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
