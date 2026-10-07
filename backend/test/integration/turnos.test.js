const { resetDatabase, closeDatabase } = require('../helpers/testEnv');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const app = require('../../src/app');
const db = require('../../src/config/db');
const { hoy } = require('../../src/shared/dates');
const { crearUsuario, auth, crearSector, crearLote, conceptoId } = require('../helpers/fixtures');

let admin, comunero, vecino, lote, loteVecino;

before(async () => {
  await resetDatabase();
  admin = await crearUsuario({ rol: 'ADMIN' });
  comunero = await crearUsuario();
  vecino = await crearUsuario();
  const sector = await crearSector('La Jones Alta');
  lote = await crearLote({ sectorId: sector, personaId: comunero.personaId, codigo: 'LJA-101' });
  loteVecino = await crearLote({ sectorId: sector, personaId: vecino.personaId, codigo: 'LJA-102' });
});
after(closeDatabase);

const crear = (body) => request(app).post('/api/turnos').set(auth(admin)).send(body);
const editar = (id, body) => request(app).put(`/api/turnos/${id}`).set(auth(admin)).send(body);
const base = () => ({ persona_id: comunero.personaId, lote_id: lote, dia_semana: 2 });

test('las horas sin cero inicial se comparan como horas, no como texto', async () => {
  // Como texto, '9:00' > '10:00'; antes este turno válido se rechazaba.
  const r = await crear({ ...base(), hora_inicio: '9:00', hora_fin: '10:00' });
  assert.equal(r.status, 201, r.body.message);
  const [[t]] = await db.query('SELECT hora_inicio, hora_fin, tipo FROM turnos_riego WHERE id = ?', [r.body.turnoId]);
  assert.deepEqual(t, { hora_inicio: '09:00:00', hora_fin: '10:00:00', tipo: 'REGULAR' });

  const cruce = await crear({ ...base(), hora_inicio: '09:30', hora_fin: '11:00' });
  assert.equal(cruce.status, 409);
  assert.match(cruce.body.message, /09:00 a 10:00/);
  assert.equal((await crear({ ...base(), hora_inicio: '10:00', hora_fin: '11:00' })).status, 201, 'turno contiguo');
  assert.equal((await crear({ ...base(), hora_inicio: '12:00', hora_fin: '11:00' })).status, 400);
  assert.equal((await crear({ ...base(), dia_semana: 8, hora_inicio: '06:00', hora_fin: '07:00' })).status, 400);
});

test('el lote debe pertenecer al comunero', async () => {
  const r = await crear({ ...base(), lote_id: loteVecino, hora_inicio: '06:00', hora_fin: '07:00' });
  assert.equal(r.status, 400);
  assert.match(r.body.message, /LJA-102/);
});

test('un turno adicional genera su cobro en el mes de Ecuador y se acumula si hay otro pendiente', async () => {
  const primero = await crear({ ...base(), dia_semana: 5, tipo: 'ADICIONAL', hora_inicio: '06:00', hora_fin: '07:00' });
  assert.equal(primero.status, 201);
  assert.ok(primero.body.obligacionId);
  const segundo = await crear({ ...base(), dia_semana: 6, tipo: 'ADICIONAL', costo: 3.25, hora_inicio: '06:00', hora_fin: '07:00' });
  assert.equal(segundo.body.obligacionId, primero.body.obligacionId);

  const [[ob]] = await db.query('SELECT valor, periodo_anio, periodo_mes, concepto_id, estado FROM obligaciones WHERE id = ?', [primero.body.obligacionId]);
  assert.equal(ob.valor, 8.25);
  assert.equal(ob.concepto_id, await conceptoId('TURNO_ADICIONAL'));
  assert.equal(`${ob.periodo_anio}-${String(ob.periodo_mes).padStart(2, '0')}`, hoy().slice(0, 7));
});

test('si el cobro falla no queda un turno a medias', async () => {
  await db.query("UPDATE conceptos_cobro SET activo = FALSE WHERE codigo = 'TURNO_ADICIONAL'");
  try {
    const [[{ antes }]] = await db.query('SELECT COUNT(*) AS antes FROM turnos_riego');
    const r = await crear({ ...base(), dia_semana: 7, tipo: 'ADICIONAL', hora_inicio: '06:00', hora_fin: '07:00' });
    assert.equal(r.status, 409);
    const [[{ despues }]] = await db.query('SELECT COUNT(*) AS despues FROM turnos_riego');
    assert.equal(despues, antes);
  } finally {
    await db.query("UPDATE conceptos_cobro SET activo = TRUE WHERE codigo = 'TURNO_ADICIONAL'");
  }
});

test('editar sin enviar el tipo conserva un turno ADICIONAL y valida cruces con el horario final', async () => {
  const r = await crear({ ...base(), dia_semana: 3, tipo: 'ADICIONAL', costo: 0, hora_inicio: '14:00', hora_fin: '15:00' });
  assert.equal(r.status, 201);
  assert.equal(r.body.obligacionId, null, 'costo 0 no genera cobro');

  assert.equal((await editar(r.body.turnoId, { hora_fin: '16:00' })).status, 200);
  const [[t]] = await db.query('SELECT tipo, hora_inicio, hora_fin FROM turnos_riego WHERE id = ?', [r.body.turnoId]);
  assert.deepEqual(t, { tipo: 'ADICIONAL', hora_inicio: '14:00:00', hora_fin: '16:00:00' });

  assert.equal((await editar(r.body.turnoId, { dia_semana: 2, hora_inicio: '09:30', hora_fin: '10:30' })).status, 409);
  assert.equal((await editar(r.body.turnoId, { hora_inicio: '17:00' })).status, 400, 'inicio después del fin guardado');
  assert.equal((await editar(999999, { hora_fin: '16:00' })).status, 404);
});

test('eliminar desactiva el turno una sola vez', async () => {
  const r = await crear({ ...base(), dia_semana: 4, hora_inicio: '06:00', hora_fin: '07:00' });
  assert.equal((await request(app).delete(`/api/turnos/${r.body.turnoId}`).set(auth(admin))).status, 200);
  assert.equal((await request(app).delete(`/api/turnos/${r.body.turnoId}`).set(auth(admin))).status, 404);
  assert.equal((await request(app).get('/api/turnos?dia_semana=x').set(auth(admin))).status, 400);
});
