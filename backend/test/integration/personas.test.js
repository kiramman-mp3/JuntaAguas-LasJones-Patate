const { resetDatabase, closeDatabase } = require('../helpers/testEnv');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const app = require('../../src/app');
const { crearUsuario, crearPersona, auth } = require('../helpers/fixtures');

let admin, moreta;

before(async () => {
  await resetDatabase();
  admin = await crearUsuario({ rol: 'ADMIN' });
  moreta = await crearPersona({ nombres: 'Carlos', apellidos: 'Moreta Acosta' });
  await crearPersona({ nombres: 'Manuel', apellidos: 'Acosta Pérez' });
});
after(closeDatabase);

const cedulasDe = async (texto) => {
  const res = await request(app).get('/api/personas').query({ busqueda: texto }).set(auth(admin));
  assert.equal(res.status, 200);
  return res.body.data.map((p) => p.cedula);
};

test('la búsqueda acepta "Apellidos Nombres" además de "Nombres Apellidos" (H-29)', async () => {
  assert.deepEqual(await cedulasDe('Moreta Acosta Carlos'), [moreta.cedula]);
  assert.deepEqual(await cedulasDe('Carlos Moreta Acosta'), [moreta.cedula]);
  assert.deepEqual(await cedulasDe(moreta.cedula), [moreta.cedula]);
  assert.deepEqual(await cedulasDe('Carlos Pérez'), []);
});
