const { resetDatabase, closeDatabase } = require('../helpers/testEnv');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const app = require('../../src/app');

before(resetDatabase);
after(closeDatabase);

test('la comprobación de salud verifica la base y devuelve un X-Request-Id', async () => {
  const res = await request(app).get('/api/health');
  assert.equal(res.status, 200);
  assert.equal(res.body.database, 'OK');
  assert.match(res.headers['x-request-id'], /^[0-9a-f-]{36}$/);
});

test('el identificador que envía el proxy se conserva en la respuesta', async () => {
  const res = await request(app).get('/api/ruta-inexistente').set('X-Request-Id', 'proxy-trace-0001');
  assert.equal(res.status, 404);
  assert.equal(res.headers['x-request-id'], 'proxy-trace-0001');
});
