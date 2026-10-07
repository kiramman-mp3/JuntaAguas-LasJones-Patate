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

test('transferir un lote queda auditado con el titular anterior y mueve sus turnos activos', async () => {
  const anterior = await crearUsuario();
  const nuevo = await crearUsuario();
  const loteId = await crearLote({ sectorId: sectorAlto, personaId: anterior.personaId, codigo: 'LJA-030' });
  await db.query("INSERT INTO turnos_riego (persona_id, lote_id, dia_semana, hora_inicio, hora_fin) VALUES (?, ?, 1, '06:00', '07:00')", [anterior.personaId, loteId]);
  const vincular = (body) => request(app).post(`/api/lotes/${loteId}/vincular-persona`).set(auth(admin)).send(body);

  const res = await vincular({ persona_id: nuevo.personaId });
  assert.equal(res.status, 200);
  assert.equal(res.body.turnosReasignados, 1);
  const [[titular]] = await db.query('SELECT persona_id FROM persona_lotes WHERE lote_id = ?', [loteId]);
  assert.equal(titular.persona_id, nuevo.personaId);
  const [[turno]] = await db.query('SELECT persona_id FROM turnos_riego WHERE lote_id = ?', [loteId]);
  assert.equal(turno.persona_id, nuevo.personaId);
  const [[auditoria]] = await db.query("SELECT accion, detalle FROM auditoria WHERE entidad = 'persona_lotes' AND entidad_id = ? ORDER BY id DESC LIMIT 1", [loteId]);
  assert.equal(auditoria.accion, 'TRANSFERIR');
  const detalle = typeof auditoria.detalle === 'string' ? JSON.parse(auditoria.detalle) : auditoria.detalle;
  assert.equal(detalle.anterior.persona_id, anterior.personaId);

  assert.equal((await vincular({ persona_id: nuevo.personaId })).status, 400, 'ya es el titular');
  assert.equal((await vincular({ persona_id: 999999 })).status, 404);
  assert.equal((await request(app).post('/api/lotes/999999/vincular-persona').set(auth(admin)).send({ persona_id: nuevo.personaId })).status, 404);
});

test('un lote pertenece al 100 % a un solo comunero: no admite propiedad compartida', async () => {
  const titular = await crearUsuario();
  const otro = await crearUsuario();
  const loteId = await crearLote({ sectorId: sectorAlto, codigo: 'LJA-050' });
  const vincular = (body) => request(app).post(`/api/lotes/${loteId}/vincular-persona`).set(auth(admin)).send(body);

  const parcial = await vincular({ persona_id: titular.personaId, porcentaje: 50 });
  assert.equal(parcial.status, 400);
  assert.match(JSON.stringify(parcial.body), /100 %/);
  assert.equal((await request(app).post('/api/lotes').set(auth(admin)).send({ sector_id: sectorAlto, codigo: 'LJA-051', persona_id: titular.personaId, porcentaje: 60 })).status, 400);

  assert.equal((await vincular({ persona_id: titular.personaId, porcentaje: 100 })).status, 200);
  // Vincular a otro comunero transfiere el lote completo: nunca quedan dos dueños.
  assert.equal((await vincular({ persona_id: otro.personaId })).status, 200);
  const [filas] = await db.query('SELECT persona_id, porcentaje FROM persona_lotes WHERE lote_id = ?', [loteId]);
  assert.equal(filas.length, 1);
  assert.equal(filas[0].persona_id, otro.personaId);
  assert.equal(Number(filas[0].porcentaje), 100);

  // La base de datos también rechaza un porcentaje distinto de 100.
  await assert.rejects(db.query('UPDATE persona_lotes SET porcentaje = 40 WHERE lote_id = ?', [loteId]));
});

test('valida las coordenadas y el sector al crear un lote', async () => {
  const crear = (body) => request(app).post('/api/lotes').set(auth(admin)).send({ sector_id: sectorAlto, ...body });
  assert.equal((await crear({ codigo: 'LJA-040', latitud_aproximada: 120 })).status, 400);
  assert.equal((await crear({ codigo: 'LJA-041', latitud_aproximada: '', longitud_aproximada: '' })).status, 201, 'vacíos se guardan como null');
  assert.equal((await request(app).post('/api/lotes').set(auth(admin)).send({ sector_id: 999999, codigo: 'LJA-042' })).status, 404);
});
