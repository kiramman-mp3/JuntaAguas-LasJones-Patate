const { resetDatabase, closeDatabase } = require('../helpers/testEnv');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const app = require('../../src/app');
const db = require('../../src/config/db');
const { crearUsuario, auth, crearSector, crearLote } = require('../helpers/fixtures');

let admin, usuario, vecino, lote, loteVecino;

before(async () => {
  await resetDatabase();
  admin = await crearUsuario({ rol: 'ADMIN' });
  usuario = await crearUsuario();
  vecino = await crearUsuario();
  const sector = await crearSector('La Jones Alta');
  lote = await crearLote({ sectorId: sector, personaId: usuario.personaId, codigo: 'LJA-101' });
  loteVecino = await crearLote({ sectorId: sector, personaId: vecino.personaId, codigo: 'LJA-102' });
});
after(closeDatabase);

const crear = (body) => request(app).post('/api/turnos').set(auth(admin)).send(body);
const editar = (id, body) => request(app).put(`/api/turnos/${id}`).set(auth(admin)).send(body);
const base = () => ({ persona_id: usuario.personaId, lote_id: lote, dia_semana: 2 });

test('las horas sin cero inicial se comparan como horas, no como texto', async () => {
  // Como texto, '9:00' > '10:00'; antes este turno válido se rechazaba.
  const r = await crear({ ...base(), hora_inicio: '9:00', hora_fin: '10:00' });
  assert.equal(r.status, 201, r.body.message);
  const [[t]] = await db.query('SELECT hora_inicio, hora_fin FROM turnos_riego WHERE id = ?', [r.body.turnoId]);
  assert.deepEqual(t, { hora_inicio: '09:00:00', hora_fin: '10:00:00' });

  const cruce = await crear({ ...base(), hora_inicio: '09:30', hora_fin: '11:00' });
  assert.equal(cruce.status, 409);
  assert.match(cruce.body.message, /09:00 a 10:00/);
  assert.equal((await crear({ ...base(), hora_inicio: '10:00', hora_fin: '11:00' })).status, 201, 'turno contiguo');
  assert.equal((await crear({ ...base(), hora_inicio: '12:00', hora_fin: '11:00' })).status, 400);
  assert.equal((await crear({ ...base(), dia_semana: 8, hora_inicio: '06:00', hora_fin: '07:00' })).status, 400);
});

test('dos lotes del mismo sector no pueden regar a la vez; en otro sector sí', async () => {
  const delVecino = { persona_id: vecino.personaId, lote_id: loteVecino, dia_semana: 2 };
  const cruce = await crear({ ...delVecino, hora_inicio: '09:30', hora_fin: '10:30' });
  assert.equal(cruce.status, 409);
  assert.match(cruce.body.message, /sector.*LJA-101/);

  const otroSector = await crearSector('La Jones Baja');
  const loteBajo = await crearLote({ sectorId: otroSector, personaId: vecino.personaId, codigo: 'LJB-201' });
  const r = await crear({ persona_id: vecino.personaId, lote_id: loteBajo, dia_semana: 2, hora_inicio: '09:30', hora_fin: '10:30' });
  assert.equal(r.status, 201, r.body.message);
});

test('el lote debe pertenecer al usuario', async () => {
  const r = await crear({ ...base(), lote_id: loteVecino, hora_inicio: '06:00', hora_fin: '07:00' });
  assert.equal(r.status, 400);
  assert.match(r.body.message, /LJA-102/);
});

test('ya no existen turnos adicionales: el tipo y el costo no se aceptan ni generan cobros', async () => {
  const r = await crear({ ...base(), dia_semana: 5, tipo: 'ADICIONAL', costo: 5, hora_inicio: '06:00', hora_fin: '07:00' });
  assert.equal(r.status, 201, r.body.message);
  assert.equal(r.body.obligacionId, undefined);
  const [[{ cobros }]] = await db.query(
    "SELECT COUNT(*) AS cobros FROM obligaciones o JOIN conceptos_cobro c ON c.id = o.concepto_id WHERE c.codigo = 'TURNO_ADICIONAL'"
  );
  assert.equal(cobros, 0);
  const [columnas] = await db.query(
    "SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'turnos_riego' AND COLUMN_NAME = 'tipo'"
  );
  assert.equal(columnas.length, 0);
  const [[concepto]] = await db.query("SELECT activo FROM conceptos_cobro WHERE codigo = 'TURNO_ADICIONAL'");
  assert.equal(Boolean(concepto.activo), false);
});

test('editar conserva los campos omitidos y valida cruces con el horario final', async () => {
  const r = await crear({ ...base(), dia_semana: 3, hora_inicio: '14:00', hora_fin: '15:00' });
  assert.equal(r.status, 201);

  assert.equal((await editar(r.body.turnoId, { hora_fin: '16:00' })).status, 200);
  const [[t]] = await db.query('SELECT dia_semana, hora_inicio, hora_fin FROM turnos_riego WHERE id = ?', [r.body.turnoId]);
  assert.deepEqual(t, { dia_semana: 3, hora_inicio: '14:00:00', hora_fin: '16:00:00' });

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

test('el cronograma completo, con usuarios y cédulas, es solo para la directiva', async () => {
  assert.equal((await request(app).get('/api/turnos/cronograma')).status, 401);
  assert.equal((await request(app).get('/api/turnos/cronograma').set(auth(usuario))).status, 403);

  const res = await request(app).get('/api/turnos/cronograma').set(auth(admin));
  assert.equal(res.status, 200);
  const sector = res.body.data.find((s) => s.sector_nombre === 'La Jones Alta');
  assert.equal(sector.dias.length, 7);
  const turno = sector.dias.flatMap((d) => d.turnos)[0];
  assert.ok(turno.usuario_nombre);
  assert.ok(turno.cedula);
});

test('el cronograma público muestra solo horarios por sector y lote, sin datos personales', async () => {
  const res = await request(app).get('/api/turnos/cronograma-publico');
  assert.equal(res.status, 200);
  const sector = res.body.data.find((s) => s.sector_nombre === 'La Jones Alta');
  assert.ok(sector.total_turnos > 0);
  const turnosPublicos = sector.dias.flatMap((d) => d.turnos);
  for (const t of turnosPublicos) {
    assert.deepEqual(Object.keys(t).sort(), ['duracion_minutos', 'hora_fin', 'hora_inicio', 'id', 'lote_codigo']);
  }
  const json = JSON.stringify(res.body);
  for (const dato of [usuario.cedula, vecino.cedula, 'De Prueba']) assert.ok(!json.includes(dato), `expone ${dato}`);
  assert.equal((await request(app).get('/api/turnos/publicos/cronograma')).status, 404, 'sin rutas duplicadas');
});