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
});
after(closeDatabase);

const post = (ruta, body) => request(app).post(ruta).set(auth(admin)).send(body);

test('los planes se devuelven con sus actividades en dos consultas, sin importar cuántos planes haya', async () => {
  const planes = [];
  for (const anio of [2024, 2025, 2026]) {
    const r = await post('/api/planes', { anio, descripcion: `Plan ${anio}` });
    assert.equal(r.status, 201);
    planes.push(r.body.planId);
  }
  assert.equal((await post(`/api/planes/${planes[2]}/actividades`, { nombre: 'Limpieza del canal', fecha_inicio: '2026-03-01', fecha_fin: '2026-03-05' })).status, 201);
  assert.equal((await post(`/api/planes/${planes[2]}/actividades`, { nombre: 'Asamblea anual', fecha_inicio: '2026-01-10', fecha_fin: '2026-01-10' })).status, 201);

  const original = db.query.bind(db);
  let consultas = 0;
  db.query = (...args) => { consultas++; return original(...args); };
  let res;
  try {
    res = await request(app).get('/api/planes').set(auth(admin));
  } finally {
    db.query = original;
  }
  assert.equal(res.status, 200);
  assert.ok(consultas <= 4, `se esperaban a lo sumo 4 consultas (incluida la autenticación), hubo ${consultas}`);
  assert.deepEqual(res.body.data.map((p) => p.anio), [2026, 2025, 2024]);
  assert.deepEqual(res.body.data[0].actividades.map((a) => a.nombre), ['Asamblea anual', 'Limpieza del canal']);
  assert.deepEqual(res.body.data[1].actividades, []);
});

test('la planificación valida el año, las fechas y que el plan exista', async () => {
  assert.equal((await post('/api/planes', { anio: 2026 })).status, 409, 'año repetido');
  assert.equal((await post('/api/planes', { anio: 'dos mil' })).status, 400);
  const [[plan]] = await db.query('SELECT id FROM planes_anuales WHERE anio = 2026');
  assert.equal((await post(`/api/planes/${plan.id}/actividades`, { nombre: 'Al revés', fecha_inicio: '2026-05-10', fecha_fin: '2026-05-01' })).status, 400);
  assert.equal((await post('/api/planes/999999/actividades', { nombre: 'Huérfana', fecha_inicio: '2026-05-01', fecha_fin: '2026-05-02' })).status, 404);
});

test('el inventario valida el bien y rechaza códigos repetidos', async () => {
  const bien = { codigo: 'INV-900', nombre: 'Pala', cantidad: 3, valor_unitario: 12.5, estado_fisico: 'bueno' };
  const creado = await post('/api/inventario', bien);
  assert.equal(creado.status, 201);
  const [[fila]] = await db.query('SELECT estado_fisico, cantidad FROM bienes_inventario WHERE id = ?', [creado.body.bienId]);
  assert.deepEqual(fila, { estado_fisico: 'BUENO', cantidad: 3 });

  assert.equal((await post('/api/inventario', bien)).status, 409);
  assert.equal((await post('/api/inventario', { nombre: 'Sin valor' })).status, 400);
  assert.equal((await post('/api/inventario', { nombre: 'Negativo', valor_unitario: -1 })).status, 400);
  assert.equal((await post('/api/inventario', { nombre: 'Estado raro', valor_unitario: 1, estado_fisico: 'ROTO' })).status, 400);
});

test('actualiza una actividad de planificación y valida fechas y estados (H-04)', async () => {
  const usuarioComun = await crearUsuario({ rol: 'USUARIO' });
  const [[plan]] = await db.query('SELECT id FROM planes_anuales WHERE anio = 2026');
  const actRes = await post(`/api/planes/${plan.id}/actividades`, {
    nombre: 'Mantenimiento de compuertas',
    fecha_inicio: '2026-04-01',
    fecha_fin: '2026-04-10'
  });
  assert.equal(actRes.status, 201);
  const actividadId = actRes.body.actividadId;

  // Usuario común no puede actualizar
  assert.equal((await request(app).patch(`/api/planes/${plan.id}/actividades/${actividadId}`).set(auth(usuarioComun)).send({ estado: 'EN_PROCESO' })).status, 403);

  // Rechaza fecha_inicio > fecha_fin
  const resFechas = await request(app).patch(`/api/planes/${plan.id}/actividades/${actividadId}`).set(auth(admin)).send({
    fecha_inicio: '2026-04-20',
    fecha_fin: '2026-04-05'
  });
  assert.equal(resFechas.status, 400);

  // Actualización exitosa (a través del alias /api/planificacion)
  const resOk = await request(app).patch(`/api/planificacion/${plan.id}/actividades/${actividadId}`).set(auth(admin)).send({
    estado: 'CUMPLIDA',
    fecha_cumplimiento: '2026-04-08',
    observacion_resultado: 'Trabajo concluido con la participación de 35 usuarios.'
  });
  assert.equal(resOk.status, 200);

  const [[actDb]] = await db.query('SELECT estado, fecha_cumplimiento, observacion_resultado FROM actividades_plan WHERE id = ?', [actividadId]);
  assert.equal(actDb.estado, 'CUMPLIDA');
  assert.equal(actDb.fecha_cumplimiento, '2026-04-08');
  assert.equal(actDb.observacion_resultado, 'Trabajo concluido con la participación de 35 usuarios.');

  // 404 en actividad o plan inexistente
  assert.equal((await request(app).patch(`/api/planes/${plan.id}/actividades/999999`).set(auth(admin)).send({ estado: 'PENDIENTE' })).status, 404);

  // Bloqueo si el plan está CERRADO
  await db.query("UPDATE planes_anuales SET estado = 'CERRADO' WHERE id = ?", [plan.id]);
  const resCerrado = await request(app).patch(`/api/planes/${plan.id}/actividades/${actividadId}`).set(auth(admin)).send({ estado: 'PENDIENTE' });
  assert.equal(resCerrado.status, 409);
});
