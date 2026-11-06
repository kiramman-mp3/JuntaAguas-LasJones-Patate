const { resetDatabase, closeDatabase } = require('../helpers/testEnv');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const app = require('../../src/app');
const db = require('../../src/config/db');
const { crearUsuario, auth } = require('../helpers/fixtures');

let admin;

before(async () => {
  await resetDatabase();
  admin = await crearUsuario({ rol: 'ADMIN' });
  const filas = Array.from({ length: 5 }, (_, i) => [admin.cuentaId, 'PRUEBA_PAGINA', 'pruebas', i + 1, `2025-04-0${i + 1} 15:00:00`]);
  await db.query('INSERT INTO auditoria (cuenta_id, accion, entidad, entidad_id, fecha) VALUES ?', [filas]);
});
after(closeDatabase);

const pagina = (page, limit) =>
  request(app).get('/api/auditoria').query({ accion: 'PRUEBA_PAGINA', page, limit }).set(auth(admin));

test('la auditoría se pagina y devuelve el total de registros (H-24)', async () => {
  const primera = await pagina(1, 2);
  assert.equal(primera.status, 200);
  assert.deepEqual(primera.body.pagination, { total: 5, page: 1, limit: 2 });
  assert.deepEqual(primera.body.data.map((r) => r.entidad_id), [5, 4], 'del más reciente al más antiguo');

  const ultima = await pagina(3, 2);
  assert.deepEqual(ultima.body.data.map((r) => r.entidad_id), [1]);

  const fuera = await pagina(4, 2);
  assert.equal(fuera.body.data.length, 0);
  assert.equal(fuera.body.pagination.total, 5);
});

test('sin page ni limit conserva el comportamiento anterior y valida los parámetros', async () => {
  const res = await request(app).get('/api/auditoria').query({ accion: 'PRUEBA_PAGINA' }).set(auth(admin));
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.pagination, { total: 5, page: 1, limit: 100 });
  assert.equal(res.body.data.length, 5);

  assert.equal((await pagina(0, 2)).status, 400);
  assert.equal((await pagina(1, 101)).status, 400);
});
