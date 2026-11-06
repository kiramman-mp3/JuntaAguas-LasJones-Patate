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

test('el alta exige una fecha de nacimiento de mayor de edad (18 años)', async () => {
  const crear = (cedula, fecha_nacimiento) => request(app).post('/api/personas').set(auth(admin))
    .send({ cedula, nombres: 'Edad', apellidos: 'Prueba', fecha_nacimiento });
  const [a, m, d] = require('../../src/shared/schemas').fechaMaximaNacimiento().split('-');
  const manana = new Date(Date.UTC(Number(a), Number(m) - 1, Number(d) + 1)).toISOString().slice(0, 10);

  const menor = await crear('1710034065', manana);
  assert.equal(menor.status, 400);
  assert.match(JSON.stringify(menor.body), /al menos 18 años/);
  assert.equal((await crear('1710034065', '2099-01-01')).status, 400);
  assert.equal((await crear('1710034065', '1850-01-01')).status, 400);
  assert.equal((await crear('1710034065', `${a}-${m}-${d}`)).status, 201);
  assert.equal((await crear('0926687856', '')).status, 201, 'la fecha de nacimiento sigue siendo opcional');
});

test('la búsqueda trata % y _ como texto, no como comodines', async () => {
  assert.deepEqual(await cedulasDe('%'), []);
  assert.deepEqual(await cedulasDe('_'), []);
  assert.deepEqual(await cedulasDe('Carl_s'), []);
  assert.deepEqual(await cedulasDe('Carlos'), [moreta.cedula]);
});
