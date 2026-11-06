const { resetDatabase, closeDatabase } = require('../helpers/testEnv');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const app = require('../../src/app');
const { crearUsuario, crearPersona, auth, crearSector, crearLote } = require('../helpers/fixtures');

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

test('Mi cuenta lista todos los lotes del usuario, no solo el primero (H-23)', async () => {
  const socio = await crearUsuario();
  const alto = await crearSector('La Jones Alta');
  const bajo = await crearSector('La Jones Baja');
  await crearLote({ sectorId: bajo, personaId: socio.personaId, codigo: 'LJB-020' });
  await crearLote({ sectorId: alto, personaId: socio.personaId, codigo: 'LJA-010' });

  const res = await request(app).get(`/api/personas/consulta/${socio.cedula}`).set(auth(socio));
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.resultado.lotes, [
    { codigo: 'LJA-010', sector: 'La Jones Alta' },
    { codigo: 'LJB-020', sector: 'La Jones Baja' }
  ]);
  assert.equal(res.body.resultado.loteCodigo, 'LJA-010', 'el primer lote se mantiene para clientes anteriores');

  const sinLotes = await crearUsuario();
  const vacio = await request(app).get(`/api/personas/consulta/${sinLotes.cedula}`).set(auth(sinLotes));
  assert.deepEqual(vacio.body.resultado.lotes, []);
  assert.equal(vacio.body.resultado.loteCodigo, 'N/A');
});
