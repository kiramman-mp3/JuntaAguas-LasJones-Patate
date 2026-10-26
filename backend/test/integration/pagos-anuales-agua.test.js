const { resetDatabase, closeDatabase } = require('../helpers/testEnv');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../../src/app');
const db = require('../../src/config/db');
const { hoy } = require('../../src/shared/dates');
const { crearUsuario, auth, crearPersona, crearSector, crearLote, conceptoId } = require('../helpers/fixtures');

let admin, usuario, otro;
const ANIO_ACTUAL = Number(hoy().slice(0, 4));
const generar = (cuerpo, quien = admin) => request(app).post('/api/financiero/agua-anual/obligaciones').set(auth(quien)).send(cuerpo);
const pendientes = (personaId, quien = admin) => request(app).get(`/api/financiero/agua-anual/obligaciones/${personaId}`).set(auth(quien));
const pagar = (cuerpo, quien = admin) => request(app).post('/api/financiero/agua-anual/pagos').set(auth(quien)).send(cuerpo);
const balance = () => request(app).get('/api/financiero/balance').set(auth(admin));

before(async () => {
  await resetDatabase();
  admin = await crearUsuario({ rol: 'ADMIN' });
  usuario = await crearUsuario();
  otro = await crearUsuario();
  const sector = await crearSector('La Jones Media');
  await crearLote({ sectorId: sector, personaId: usuario.personaId, codigo: 'LJM-001' });
  await crearLote({ sectorId: sector, personaId: otro.personaId, codigo: 'LJM-002' });
});
after(closeDatabase);

test('solo la directiva genera, consulta y registra pagos anuales de agua', async () => {
  assert.equal((await request(app).post('/api/financiero/agua-anual/obligaciones').send({ anio: 2026, valor_total: 10 })).status, 401);
  assert.equal((await generar({ anio: 2026, valor_total: 10 }, usuario)).status, 403);
  assert.equal((await pendientes(usuario.personaId, usuario)).status, 403);
  assert.equal((await pagar({ persona_id: usuario.personaId, obligacionesIds: [1], metodo: 'DEPOSITO', referencia: 'D-1' }, usuario)).status, 403);
});

test('valida el año y el valor al generar, y no emite años futuros', async () => {
  for (const cuerpo of [{ valor_total: 10 }, { anio: 1999, valor_total: 10 }, { anio: 2026, valor_total: 0 }, { anio: 2026, valor_total: 'x' }]) {
    assert.equal((await generar(cuerpo)).status, 400, JSON.stringify(cuerpo));
  }
  const futuro = await generar({ anio: ANIO_ACTUAL + 1, valor_total: 10 });
  assert.equal(futuro.status, 400);
  assert.match(futuro.body.message, /futuros/);
  const sinTarifa = await generar({ anio: 2024 });
  assert.equal(sinTarifa.status, 409, 'sin valor ni tarifa AGUA_ANUAL vigente');
  assert.match(sinTarifa.body.message, /tarifa/);
});

test('sin valor usa la tarifa AGUA_ANUAL vigente al 1 de enero y simular no escribe', async () => {
  const tarifa = await request(app).post('/api/financiero/tarifas').set(auth(admin))
    .send({ concepto_id: await conceptoId('AGUA_ANUAL'), valor: 36, vigencia_desde: '2023-01-01' });
  assert.equal(tarifa.status, 201, JSON.stringify(tarifa.body));
  const simulacion = await generar({ anio: 2023, simular: true });
  assert.equal(simulacion.status, 200);
  assert.deepEqual(simulacion.body.data, { anio: 2023, valor: 36, usuarios: 2, generadas: 2, existentes: 0, total: 72 });
  const [[{ antes }]] = await db.query('SELECT COUNT(*) AS antes FROM obligacion_anual_agua WHERE periodo_anio = 2023');
  assert.equal(antes, 0);
});

test('genera una obligación por usuario activo con lote y repetir no duplica', async () => {
  await crearPersona({ estado: 'INACTIVO' });
  await crearPersona({ nombres: 'Sin lote' });
  const activos = 2; // usuario y otro: el administrador, el inactivo y quien no tiene lote no pagan agua.

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

  const [[fechas]] = await db.query(
    'SELECT fecha_emision, fecha_vencimiento FROM obligacion_anual_agua WHERE periodo_anio = 2026 AND persona_id = ?', [usuario.personaId]
  );
  assert.deepEqual(fechas, { fecha_emision: '2026-01-01', fecha_vencimiento: '2026-12-31' });

  const resumen = await request(app).get('/api/financiero/agua-anual/resumen?anio=2026').set(auth(admin));
  assert.equal(resumen.status, 200);
  assert.deepEqual(resumen.body.data, { anio: 2026, emitidas: 2, pagadas: 0, pendientes: 2, total: 20, recaudado: 0 });
  assert.equal((await request(app).get('/api/financiero/agua-anual/resumen').set(auth(usuario))).status, 403);
});

test('el usuario ve su pago anual pendiente en su estado de cuenta', async () => {
  const res = await request(app).get(`/api/personas/consulta/${usuario.cedula}`).set(auth(usuario));
  assert.equal(res.status, 200);
  const agua = res.body.resultado.deudas.filter((d) => d.tipo === 'AGUA_ANUAL');
  assert.deepEqual(agua.map((d) => [d.anio, d.valor, d.estado]), [[2026, 10, 'PENDIENTE']]);
  assert.equal(res.body.resultado.totalPendiente, 10);
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
  assert.ok(estados.every((e) => e.estado === 'PAGADA'));
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

test('una obligación anual de un año ya cerrado cuenta como cartera vencida', async () => {
  await generar({ anio: 2024, valor_total: 5 });
  const vencido = Number((await db.query(
    "SELECT COALESCE(SUM(valor_total), 0) AS v FROM obligacion_anual_agua WHERE estado = 'PENDIENTE' AND fecha_vencimiento < ?", [hoy()]
  ))[0][0].v);
  assert.ok(vencido >= 10);
  const { body } = await balance();
  assert.ok(body.balance.totalVencido >= vencido);
  const panel = (await request(app).get('/api/dashboard/resumen').set(auth(admin))).body.data.finanzas;
  assert.ok(panel.carteraVencida >= vencido);
  assert.ok(panel.usuariosEnMora >= 2);
});

test('lista los pagos anuales: la directiva todos, el usuario solo los suyos, y el detalle sirve para reimprimir', async () => {
  const todos = await request(app).get('/api/financiero/agua-anual/pagos').set(auth(admin));
  assert.equal(todos.status, 200);
  assert.ok(todos.body.data.some((p) => p.persona_id === usuario.personaId));
  assert.ok(todos.body.data.some((p) => p.persona_id === otro.personaId));
  const pagoUsuario = todos.body.data.find((p) => p.persona_id === usuario.personaId);
  assert.equal(pagoUsuario.anios, '2025, 2026');
  assert.equal(pagoUsuario.estado, 'VIGENTE');

  const propios = await request(app).get(`/api/financiero/agua-anual/pagos?persona_id=${otro.personaId}`).set(auth(usuario));
  assert.ok(propios.body.data.every((p) => p.persona_id === usuario.personaId), 'un usuario no ve pagos ajenos');

  const detalle = await request(app).get(`/api/financiero/agua-anual/pagos/${pagoUsuario.id}`).set(auth(usuario));
  assert.equal(detalle.status, 200);
  assert.deepEqual(detalle.body.data.detalles.map((d) => [d.periodo_anio, d.valor_pagado]), [[2025, 8], [2026, 10]]);
  assert.equal((await request(app).get(`/api/financiero/agua-anual/pagos/${pagoUsuario.id}`).set(auth(otro))).status, 404);
});

test('anular un pago anual devuelve sus obligaciones a pendiente, sale del balance y permite volver a cobrarlas', async () => {
  const [[pago]] = await db.query("SELECT id, valor_total FROM pago_anual_agua WHERE persona_id = ? AND estado = 'VIGENTE'", [usuario.personaId]);
  const ingresosAntes = (await balance()).body.balance.totalIngresos;
  const anular = (motivo, quien = admin) => request(app).post(`/api/financiero/agua-anual/pagos/${pago.id}/anular`).set(auth(quien)).send({ motivo });

  assert.equal((await anular('Error de digitación', usuario)).status, 403);
  assert.equal((await anular('x')).status, 400, 'motivo muy corto');
  assert.equal((await anular('Error de digitación')).status, 200);
  assert.equal((await anular('Otra vez')).status, 409);

  const [[anulado]] = await db.query('SELECT estado, motivo_anulacion, anulado_por_cuenta_id FROM pago_anual_agua WHERE id = ?', [pago.id]);
  assert.deepEqual({ ...anulado, anulado_por_cuenta_id: Number(anulado.anulado_por_cuenta_id) },
    { estado: 'ANULADO', motivo_anulacion: 'Error de digitación', anulado_por_cuenta_id: admin.cuentaId });
  assert.deepEqual((await pendientes(usuario.personaId)).body.data.map((o) => o.periodo_anio), [2024, 2025, 2026]);
  assert.equal((await balance()).body.balance.totalIngresos, Math.round((ingresosAntes - Number(pago.valor_total)) * 100) / 100);

  const ids = (await pendientes(usuario.personaId)).body.data.filter((o) => o.periodo_anio >= 2025).map((o) => o.id);
  const nuevo = await pagar({ persona_id: usuario.personaId, obligacionesIds: ids, metodo: 'DEPOSITO', referencia: 'DEP-55' });
  assert.equal(nuevo.status, 201, JSON.stringify(nuevo.body));
  const [detalles] = await db.query('SELECT pago_anual_agua_id FROM pago_anual_agua_detalle WHERE obligacion_anual_agua IN (?)', [ids]);
  assert.equal(detalles.length, 4, 'el detalle del pago anulado queda como historial');
});

test('una obligación anual pendiente se puede anular y ya no se cobra ni cuenta como deuda', async () => {
  const [[obligacion]] = await db.query("SELECT id FROM obligacion_anual_agua WHERE persona_id = ? AND periodo_anio = 2024", [usuario.personaId]);
  const anular = () => request(app).post(`/api/financiero/agua-anual/obligaciones/${obligacion.id}/anular`).set(auth(admin)).send({ motivo: 'Exonerado por asamblea' });
  assert.equal((await anular()).status, 200);
  assert.equal((await anular()).status, 409);
  assert.ok(!(await pendientes(usuario.personaId)).body.data.some((o) => o.id === obligacion.id));
  const consulta = await request(app).get(`/api/personas/consulta/${usuario.cedula}`).set(auth(usuario));
  assert.ok(!consulta.body.resultado.deudas.some((d) => d.tipo === 'AGUA_ANUAL' && d.id === obligacion.id));
});

test('el balance respeta el rango de fechas para los pagos anuales', async () => {
  const fuera = await request(app).get('/api/financiero/balance?desde=2000-01-01&hasta=2000-01-31').set(auth(admin));
  assert.equal(fuera.body.balance.totalIngresos, 0);
});
