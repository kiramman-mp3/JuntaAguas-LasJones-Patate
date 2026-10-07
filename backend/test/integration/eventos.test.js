const { resetDatabase, closeDatabase } = require('../helpers/testEnv');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const app = require('../../src/app');
const db = require('../../src/config/db');
const { hoy } = require('../../src/shared/dates');
const { crearUsuario, crearPersona, auth } = require('../helpers/fixtures');

let admin;
const comuneros = [];

function enDias(dias) {
  const d = new Date(`${hoy()}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

async function eventoPasado({ tipo = 'ASAMBLEA', fecha = '2026-01-10', estado = 'CONVOCADO', valor = 15, multa = true } = {}) {
  const [r] = await db.query(
    `INSERT INTO eventos (tipo, titulo, fecha, hora_inicio, estado, genera_multa_ausencia, valor_multa, created_by_cuenta_id)
     VALUES (?, ?, ?, '08:00', ?, ?, ?, ?)`,
    [tipo, `${tipo} de prueba ${fecha}`, fecha, estado, multa, multa ? valor : null, admin.cuentaId]
  );
  return r.insertId;
}

/** Marca a todos los comuneros del padrón; el primero queda AUSENTE. */
async function tomarAsistencia(eventoId, { ruta = 'eventos' } = {}) {
  const padron = await request(app).get(`/api/${ruta}/${eventoId}/asistencias`).set(auth(admin));
  const asistencias = padron.body.data.map((p, i) => ({ persona_id: p.persona_id, estado: i === 0 ? 'AUSENTE' : 'PRESENTE' }));
  return request(app).post(`/api/${ruta}/${eventoId}/asistencias`).set(auth(admin)).send({ asistencias });
}

const finalizar = (eventoId, ruta = 'eventos') => request(app).post(`/api/${ruta}/${eventoId}/finalizar`).set(auth(admin));

before(async () => {
  await resetDatabase();
  admin = await crearUsuario({ rol: 'ADMIN' });
  for (let i = 0; i < 3; i++) comuneros.push(await crearPersona({ nombres: `Comunero ${i}` }));
  // La multa de asamblea se configura como tarifa; la de minga se deja sin configurar a propósito.
  await db.query(
    `INSERT INTO tarifas (concepto_id, valor, vigencia_desde) SELECT id, 12.50, '2020-01-01' FROM conceptos_cobro WHERE codigo = 'MULTA_ASAMBLEA'`
  );
  await crearPersona({ nombres: 'Inactivo', estado: 'INACTIVO' });
});
after(closeDatabase);

test('crea una asamblea con su orden del día en una sola transacción', async () => {
  const res = await request(app).post('/api/eventos').set(auth(admin)).send({
    tipo: 'ASAMBLEA', titulo: 'Asamblea ordinaria', fecha: enDias(10), hora_inicio: '9:00',
    puntos_orden_dia: ['Informe de tesorería', { punto_tratar: 'Mantenimiento del canal' }, '  ']
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const [puntos] = await db.query('SELECT orden, punto_tratar FROM puntos_asamblea WHERE evento_id = ? ORDER BY orden', [res.body.eventoId]);
  assert.deepEqual(puntos.map((p) => p.punto_tratar), ['Informe de tesorería', 'Mantenimiento del canal']);
  const [[evento]] = await db.query('SELECT hora_inicio, valor_multa FROM eventos WHERE id = ?', [res.body.eventoId]);
  assert.equal(evento.hora_inicio, '09:00:00');
  assert.equal(Number(evento.valor_multa), 12.5, 'la multa sale de la tarifa vigente de MULTA_ASAMBLEA');
});

test('valida fechas, horas y el valor de la multa', async () => {
  const base = { tipo: 'ASAMBLEA', titulo: 'Asamblea', fecha: enDias(5), hora_inicio: '09:00' };
  assert.equal((await request(app).post('/api/eventos').set(auth(admin)).send({ ...base, fecha: enDias(-1) })).status, 400);
  assert.equal((await request(app).post('/api/eventos').set(auth(admin)).send({ ...base, hora_fin: '08:00' })).status, 400);
  assert.equal((await request(app).post('/api/eventos').set(auth(admin)).send({ ...base, tipo: 'OTRO' })).status, 400);

  const sinMulta = await request(app).post('/api/eventos').set(auth(admin)).send({ ...base, genera_multa_ausencia: false, valor_multa: 0 });
  assert.equal(sinMulta.status, 201);
  const [[e]] = await db.query('SELECT valor_multa FROM eventos WHERE id = ?', [sinMulta.body.eventoId]);
  assert.equal(e.valor_multa, null, 'una multa de 0 ya no se convierte en 10');
});

test('la multa no se escribe a mano: se ignora el valor enviado y se exige una tarifa configurada', async () => {
  const base = { titulo: 'Evento con multa', fecha: enDias(7), hora_inicio: '09:00' };
  const asamblea = await request(app).post('/api/eventos').set(auth(admin)).send({ ...base, tipo: 'ASAMBLEA', valor_multa: 99 });
  assert.equal(asamblea.status, 201, JSON.stringify(asamblea.body));
  const [[e]] = await db.query('SELECT valor_multa FROM eventos WHERE id = ?', [asamblea.body.eventoId]);
  assert.equal(Number(e.valor_multa), 12.5);

  const minga = await request(app).post('/api/eventos').set(auth(admin)).send({ ...base, tipo: 'MINGA', descripcion: 'Limpieza', lugar: 'Canal' });
  assert.equal(minga.status, 409);
  assert.match(minga.body.message, /Ajustes → Tarifas/);
  const mingaSinMulta = await request(app).post('/api/eventos').set(auth(admin)).send({ ...base, tipo: 'MINGA', descripcion: 'Limpieza', lugar: 'Canal', genera_multa_ausencia: false });
  assert.equal(mingaSinMulta.status, 201);
});

test('reabrir la asistencia devuelve lo ya registrado (no se pierde al guardar de nuevo)', async () => {
  const id = await eventoPasado();
  await tomarAsistencia(id);
  const padron = await request(app).get(`/api/eventos/${id}/asistencias`).set(auth(admin));
  assert.equal(padron.status, 200);
  assert.equal(padron.body.resumen.pendientes, 0);
  assert.equal(padron.body.resumen.ausentes, 1);
  assert.ok(padron.body.data.every((p) => !p.nombre.includes('Inactivo')), 'el padrón excluye inactivos sin registro');
});

test('dos asambleas del mismo mes generan cada una sus multas', async () => {
  const primera = await eventoPasado({ fecha: '2026-02-05' });
  const segunda = await eventoPasado({ fecha: '2026-02-20' });
  for (const id of [primera, segunda]) {
    await tomarAsistencia(id);
    const res = await finalizar(id);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.multasGeneradas, 1);
  }
  const [multas] = await db.query('SELECT evento_id, periodo_mes FROM obligaciones WHERE evento_id IN (?, ?)', [primera, segunda]);
  assert.equal(multas.length, 2);
  assert.ok(multas.every((m) => m.periodo_mes === null));
});

test('finalizar exige asistencia completa, estado anunciado y fecha alcanzada', async () => {
  const incompleta = await eventoPasado();
  const res = await finalizar(incompleta);
  assert.equal(res.status, 409);
  assert.equal(res.body.resumen.pendientes, comuneros.length + 1);

  assert.equal((await finalizar(await eventoPasado({ estado: 'BORRADOR' }))).status, 409);
  assert.equal((await finalizar(await eventoPasado({ estado: 'CANCELADO' }))).status, 409);
  const futura = await eventoPasado({ fecha: enDias(3) });
  await tomarAsistencia(futura);
  assert.equal((await finalizar(futura)).status, 409);
});

test('finalizar es idempotente y cierra la asistencia', async () => {
  const id = await eventoPasado();
  await tomarAsistencia(id);
  assert.equal((await finalizar(id)).body.multasGeneradas, 1);
  const otra = await finalizar(id);
  assert.equal(otra.status, 200);
  assert.equal(otra.body.yaFinalizada, true);
  assert.equal(otra.body.multasGeneradas, 0);
  assert.equal((await tomarAsistencia(id)).status, 409);
  const [[{ total }]] = await db.query('SELECT COUNT(*) AS total FROM obligaciones WHERE evento_id = ?', [id]);
  assert.equal(total, 1);
});

test('las justificaciones requieren motivo y no generan multa', async () => {
  const id = await eventoPasado({ tipo: 'MINGA' });
  const padron = (await request(app).get(`/api/mingas/${id}/asistencias`).set(auth(admin))).body.data;
  const sinMotivo = padron.map((p) => ({ persona_id: p.persona_id, estado: 'JUSTIFICADO' }));
  assert.equal((await request(app).post(`/api/mingas/${id}/asistencias`).set(auth(admin)).send({ asistencias: sinMotivo })).status, 400);

  const conMotivo = padron.map((p) => ({ persona_id: p.persona_id, estado: 'JUSTIFICADO', motivo_justificacion: 'Calamidad doméstica' }));
  assert.equal((await request(app).post(`/api/mingas/${id}/asistencias`).set(auth(admin)).send({ asistencias: conMotivo })).status, 200);
  const res = await finalizar(id, 'mingas');
  assert.equal(res.status, 200);
  assert.equal(res.body.multasGeneradas, 0);
});

test('rechaza personas repetidas o ajenas al padrón', async () => {
  const id = await eventoPasado();
  const p = comuneros[0].personaId;
  const repetida = await request(app).post(`/api/eventos/${id}/asistencias`).set(auth(admin))
    .send({ asistencias: [{ persona_id: p, estado: 'PRESENTE' }, { persona_id: p, estado: 'AUSENTE' }] });
  assert.equal(repetida.status, 400);
  const ajena = await request(app).post(`/api/eventos/${id}/asistencias`).set(auth(admin))
    .send({ asistencias: [{ persona_id: 999999, estado: 'PRESENTE' }] });
  assert.equal(ajena.status, 400);
});

test('los estados avanzan pero no retroceden; cancelado y realizado son finales', async () => {
  const id = await eventoPasado({ estado: 'BORRADOR' });
  const cambiar = (estado) => request(app).post(`/api/eventos/${id}/estado`).set(auth(admin)).send({ estado });
  assert.equal((await cambiar('PROGRAMADO')).status, 200);
  assert.equal((await cambiar('CONVOCADO')).status, 200);
  assert.equal((await cambiar('PROGRAMADO')).status, 409);
  assert.equal((await cambiar('REALIZADO')).status, 400);
  assert.equal((await cambiar('CANCELADO')).status, 200);
  assert.equal((await cambiar('CONVOCADO')).status, 409);
});

test('los endpoints de mingas no operan sobre asambleas', async () => {
  const asamblea = await eventoPasado({ tipo: 'ASAMBLEA' });
  assert.equal((await finalizar(asamblea, 'mingas')).status, 400);
});

test('guardar actas conserva los ids de los puntos y elimina los quitados', async () => {
  const crear = await request(app).post('/api/eventos').set(auth(admin)).send({
    tipo: 'ASAMBLEA', titulo: 'Asamblea extraordinaria', fecha: enDias(2), hora_inicio: '18:00',
    puntos_orden_dia: ['Uno', 'Dos', 'Tres']
  });
  const id = crear.body.eventoId;
  const [originales] = await db.query('SELECT id, punto_tratar FROM puntos_asamblea WHERE evento_id = ? ORDER BY orden', [id]);

  const res = await request(app).post(`/api/eventos/${id}/puntos`).set(auth(admin)).send({
    puntos: [
      { id: originales[2].id, punto_tratar: 'Tres', resolucion: 'Aprobado por mayoría' },
      { id: originales[0].id, punto_tratar: 'Uno' },
      { punto_tratar: 'Cuatro (nuevo)' }
    ]
  });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const [puntos] = await db.query('SELECT id, orden, punto_tratar, resolucion FROM puntos_asamblea WHERE evento_id = ? ORDER BY orden', [id]);
  assert.deepEqual(puntos.map((p) => p.punto_tratar), ['Tres', 'Uno', 'Cuatro (nuevo)']);
  assert.equal(puntos[0].id, originales[2].id);
  assert.equal(puntos[0].resolucion, 'Aprobado por mayoría');
  assert.ok(!puntos.some((p) => p.id === originales[1].id));

  const acta = await request(app).post(`/api/eventos/${id}/puntos/${puntos[0].id}/estado`).set(auth(admin)).send({ estado_acta: 'INVENTADO' });
  assert.equal(acta.status, 400);
});

test('el listado calcula asistentes y multas por evento', async () => {
  const res = await request(app).get('/api/eventos?tipo=ASAMBLEA&estado=REALIZADO').set(auth(admin));
  assert.equal(res.status, 200);
  assert.ok(res.body.data.length >= 2);
  for (const e of res.body.data) {
    assert.equal(e.asistentes, comuneros.length);
    assert.equal(e.totalComuneros, comuneros.length + 1);
    assert.equal(e.multas_generadas, 1);
  }
});
