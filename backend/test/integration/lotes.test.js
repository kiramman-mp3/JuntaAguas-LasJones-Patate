const { resetDatabase, closeDatabase } = require('../helpers/testEnv');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const app = require('../../src/app');
const db = require('../../src/config/db');
const { crearUsuario, auth, crearSector, crearLote } = require('../helpers/fixtures');

let admin, sectorAlto, sectorTambo;

before(async () => {
  await resetDatabase();
  admin = await crearUsuario({ rol: 'ADMIN' });
  sectorAlto = await crearSector('La Jones Alto');
  sectorTambo = await crearSector('El Tambo');
  await crearLote({ sectorId: sectorAlto, codigo: 'LJA-001' });
  await crearLote({ sectorId: sectorAlto, codigo: 'LJA-004' });
  // Un código del prefijo registrado en otro sector también cuenta para el consecutivo.
  await crearLote({ sectorId: sectorTambo, codigo: 'LJA-010' });
});
after(closeDatabase);

const sugerir = (sectorId) => request(app).get(`/api/lotes/sugerir-codigo?sector_id=${sectorId}`).set(auth(admin));

test('sugiere el consecutivo global del prefijo, incluyendo lotes inactivos o de otro sector', async () => {
  await db.query("UPDATE lotes SET activo = FALSE WHERE codigo = 'LJA-004'");
  const res = await sugerir(sectorAlto);
  assert.equal(res.status, 200);
  assert.equal(res.body.data.codigo, 'LJA-011');
});

test('rechaza sectores inválidos o inexistentes', async () => {
  assert.equal((await sugerir('abc')).status, 400);
  assert.equal((await sugerir(9999)).status, 404);
});

test('valida el formato del código y evita duplicados', async () => {
  const formato = await request(app).post('/api/lotes').set(auth(admin)).send({ sector_id: sectorAlto, codigo: 'cualquier texto' });
  assert.equal(formato.status, 400);
  const duplicado = await request(app).post('/api/lotes').set(auth(admin)).send({ sector_id: sectorAlto, codigo: ' lja-001 ' });
  assert.equal(duplicado.status, 409);
});

test('crea el lote con el código normalizado', async () => {
  const res = await request(app).post('/api/lotes').set(auth(admin)).send({ sector_id: sectorAlto, codigo: ' lja-020 ', superficie_m2: 1200 });
  assert.equal(res.status, 201);
  const [[lote]] = await db.query('SELECT codigo FROM lotes WHERE id = ?', [res.body.loteId]);
  assert.equal(lote.codigo, 'LJA-020');
});
