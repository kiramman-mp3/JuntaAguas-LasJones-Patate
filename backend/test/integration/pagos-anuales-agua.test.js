const { resetDatabase, closeDatabase } = require('../helpers/testEnv');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../../src/app');
const db = require('../../src/config/db');
const { crearUsuario, auth, crearPersona } = require('../helpers/fixtures');

let admin, usuario, otro;
const generar = (cuerpo, quien = admin) => request(app).post('/api/financiero/agua-anual/obligaciones').set(auth(quien)).send(cuerpo);
const pendientes = (personaId, quien = admin) => request(app).get(`/api/financiero/agua-anual/obligaciones/${personaId}`).set(auth(quien));
const pagar = (cuerpo, quien = admin) => request(app).post('/api/financiero/agua-anual/pagos').set(auth(quien)).send(cuerpo);
const balance = () => request(app).get('/api/financiero/balance').set(auth(admin));

before(async () => {
  await resetDatabase();
  admin = await crearUsuario({ rol: 'ADMIN' });
  usuario = await crearUsuario();
  otro = await crearUsuario();
});
after(closeDatabase);

test('solo la directiva genera, consulta y registra pagos anuales de agua', async () => {
  assert.equal((await request(app).post('/api/financiero/agua-anual/obligaciones').send({ anio: 2026, valor_total: 10 })).status, 401);
  assert.equal((await generar({ anio: 2026, valor_total: 10 }, usuario)).status, 403);
  assert.equal((await pendientes(usuario.personaId, usuario)).status, 403);
  assert.equal((await pagar({ persona_id: usuario.personaId, obligacionesIds: [1], metodo: 'DEPOSITO', referencia: 'D-1' }, usuario)).status, 403);
});

test('valida el año y el valor al generar', async () => {
  for (const cuerpo of [{ valor_total: 10 }, { anio: 1999, valor_total: 10 }, { anio: 2026 }, { anio: 2026, valor_total: 0 }, { anio: 2026, valor_total: 'x' }]) {
    assert.equal((await generar(cuerpo)).status, 400, JSON.stringify(cuerpo));
  }
});

test('genera una obligación por usuario activo y repetir no duplica', async () => {
  await crearPersona({ estado: 'INACTIVO' });
  const [[{ activos }]] = await db.query("SELECT COUNT(*) AS activos FROM personas WHERE estado = 'ACTIVO'");

  const primera = await generar({ anio: 2026, valor_total: 10 });
  assert.equal(primera.status, 201, JSON.stringify(primera.body));
  assert.equal(primera.body.data.generadas, activos);
  assert.equal(primera.body.data.existentes, 0);

  const segunda = await generar({ anio: 2026, valor_total: 25 });
  assert.equal(segunda.status, 201);
  assert.equal(segunda.body.data.generadas, 0);
  assert.equal(segunda.body.data.existentes, activos);

  const [[{ total, valor }]] = await db.query(
    'SELECT COUNT(*) AS total, MAX(valor_total) AS valor FROM obligacion_anual_agua WHERE periodo_anio = 2026'
  );
  assert.equal(total, activos, 'ni duplica ni cambia el valor ya emitido');
  assert.equal(Number(valor), 10);
});

test('lista las obligaciones pendientes del usuario, de la más antigua a la más reciente', async () => {
  await generar({ anio: 2025, valor_total: 8 });
  const res = await pendientes(usuario.personaId);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.data.map((o) => o.periodo_anio), [2025, 2026]);
  assert.deepEqual(res.body.data.map((o) => o.valor_total), [8, 10]);
  assert.equal((await pendientes(999999)).status, 404);
  assert.equal((await request(app).get('/api/financiero/agua-anual/obligaciones/abc').set(auth(admin))).status, 400);
});

test('registra el pago, marca las obligaciones y deja la auditoría', async () => {
  const { body } = await pendientes(usuario.personaId);
  const ids = body.data.map((o) => o.id);

  const res = await pagar({ persona_id: usuario.personaId, obligacionesIds: ids, metodo: 'TRANSFERENCIA', referencia: 'TRF-77' });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.valorTotal, 18);
  assert.equal(res.body.actualizados, 2);

  const [[pago]] = await db.query('SELECT * FROM pago_anual_agua WHERE id = ?', [res.body.pagoId]);
  assert.equal(Number(pago.valor_total), 18);
  assert.equal(pago.metodo, 'TRANSFERENCIA');
  assert.equal(pago.referencia, 'TRF-77');
  assert.equal(Number(pago.registrado_por_cuenta_id), admin.cuentaId);
  const [detalles] = await db.query('SELECT obligacion_anual_agua FROM pago_anual_agua_detalle WHERE pago_anual_agua_id = ?', [pago.id]);
  assert.equal(detalles.length, 2);
  const [estados] = await db.query('SELECT estado FROM obligacion_anual_agua WHERE id IN (?)', [ids]);
  assert.ok(estados.every((e) => e.estado === 'PAGADO'));
  assert.deepEqual((await pendientes(usuario.personaId)).body.data, []);

  const [auditoria] = await db.query("SELECT 1 FROM auditoria WHERE entidad = 'pago_anual_agua' AND accion = 'PAGO' AND entidad_id = ?", [pago.id]);
  assert.equal(auditoria.length, 1);
});

test('rechaza efectivo, referencia ausente, obligaciones ajenas o ya pagadas sin dejar pagos a medias', async () => {
  const [[propia]] = await db.query("SELECT id FROM obligacion_anual_agua WHERE persona_id = ? AND periodo_anio = 2026", [otro.personaId]);
  const [[ajena]] = await db.query("SELECT id FROM obligacion_anual_agua WHERE persona_id = ? AND periodo_anio = 2026", [usuario.personaId]);
  const [[{ pagosAntes }]] = await db.query('SELECT COUNT(*) AS pagosAntes FROM pago_anual_agua');

  const base = { persona_id: otro.personaId, obligacionesIds: [propia.id], metodo: 'DEPOSITO', referencia: 'DEP-1' };
  assert.equal((await pagar({ ...base, metodo: 'EFECTIVO' })).status, 400);
  assert.equal((await pagar({ ...base, referencia: '' })).status, 400);
  assert.equal((await pagar({ ...base, obligacionesIds: [] })).status, 400);
  assert.equal((await pagar({ ...base, obligacionesIds: [propia.id, 999999] })).status, 400);
  assert.equal((await pagar({ ...base, obligacionesIds: [propia.id, ajena.id] })).status, 400, 'una obligación de otro usuario');
  assert.equal((await pagar({ ...base, persona_id: usuario.personaId, obligacionesIds: [ajena.id] })).status, 409, 'ya pagada');

  const [[{ pagosDespues }]] = await db.query('SELECT COUNT(*) AS pagosDespues FROM pago_anual_agua');
  assert.equal(pagosDespues, pagosAntes);
  const [[obligacion]] = await db.query('SELECT estado FROM obligacion_anual_agua WHERE id = ?', [propia.id]);
  assert.equal(obligacion.estado, 'PENDIENTE', 'nada se cobra si una de las obligaciones falla');
});

test('una obligación no se paga dos veces aunque lleguen dos cobros a la vez', async () => {
  const [[obligacion]] = await db.query("SELECT id FROM obligacion_anual_agua WHERE persona_id = ? AND periodo_anio = 2025", [otro.personaId]);
  const cuerpo = { persona_id: otro.personaId, obligacionesIds: [obligacion.id], metodo: 'TRANSFERENCIA', referencia: 'TRF-9' };
  const respuestas = await Promise.all([pagar(cuerpo), pagar(cuerpo)]);
  assert.deepEqual(respuestas.map((r) => r.status).sort(), [201, 409]);
  const [[{ cobros }]] = await db.query('SELECT COUNT(*) AS cobros FROM pago_anual_agua_detalle WHERE obligacion_anual_agua = ?', [obligacion.id]);
  assert.equal(cobros, 1);
});

test('el balance, el historial y el panel suman los pagos anuales y la cartera pendiente', async () => {
  const [[{ pagado }]] = await db.query('SELECT COALESCE(SUM(valor_total), 0) AS pagado FROM pago_anual_agua');
  const [[{ pendiente }]] = await db.query("SELECT COALESCE(SUM(valor_total), 0) AS pendiente FROM obligacion_anual_agua WHERE estado = 'PENDIENTE'");
  assert.ok(Number(pagado) > 0 && Number(pendiente) > 0);

  const { body } = await balance();
  assert.equal(body.balance.totalIngresos, Number(pagado));
  assert.equal(body.balance.totalPendientes, Number(pendiente));
  assert.ok(body.carteraPorConcepto.some((c) => c.codigo === 'AGUA_ANUAL' && c.total === Number(pendiente)));
  assert.ok(body.resumenMensual.reduce((suma, m) => suma + m.ingresos, 0) >= Number(pagado));

  const historial = await request(app).get('/api/financiero/historial').set(auth(admin));
  assert.equal(historial.body.data?.total?.ingresos ?? historial.body.total?.ingresos, Number(pagado));

  const resumen = await request(app).get('/api/dashboard/resumen').set(auth(admin));
  assert.equal(resumen.status, 200, JSON.stringify(resumen.body));
  const texto = JSON.stringify(resumen.body);
  assert.ok(texto.includes(String(Number(pagado))), 'el panel muestra lo recaudado');
});

test('el balance respeta el rango de fechas para los pagos anuales', async () => {
  const fuera = await request(app).get('/api/financiero/balance?desde=2000-01-01&hasta=2000-01-31').set(auth(admin));
  assert.equal(fuera.body.balance.totalIngresos, 0);
});
