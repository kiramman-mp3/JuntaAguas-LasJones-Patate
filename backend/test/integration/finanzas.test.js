const { resetDatabase, closeDatabase } = require('../helpers/testEnv');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const app = require('../../src/app');
const db = require('../../src/config/db');
const { hoy } = require('../../src/shared/dates');
const { crearUsuario, crearPersona, auth, conceptoId, crearObligacion, crearSector, crearLote } = require('../helpers/fixtures');

let admin, comunero, vecino, aguaId;

before(async () => {
  await resetDatabase();
  admin = await crearUsuario({ rol: 'ADMIN' });
  comunero = await crearUsuario();
  vecino = await crearUsuario();
  aguaId = await conceptoId('AGUA_MENSUAL');
  const sector = await crearSector('La Jones Baja');
  await crearLote({ sectorId: sector, personaId: comunero.personaId, codigo: 'LJB-001' });
  await crearLote({ sectorId: sector, personaId: vecino.personaId, codigo: 'LJB-002' });
  // Persona activa sin lote: no debe recibir cuota de agua.
  await crearPersona({ nombres: 'Sin lote' });
});
after(closeDatabase);

const tarifa = (body) => request(app).post('/api/financiero/tarifas').set(auth(admin)).send({ concepto_id: aguaId, ...body });
const facturar = (body) => request(app).post('/api/financiero/facturacion/mensual').set(auth(admin)).send(body);
const pagar = (body) => request(app).post('/api/financiero/pagos').set(auth(admin)).send(body);

test('una tarifa nueva cierra la vigencia de la anterior y no se permiten solapes', async () => {
  assert.equal((await tarifa({ valor: 4, vigencia_desde: '2025-01-01' })).status, 201);
  assert.equal((await tarifa({ valor: 4.5, vigencia_desde: '2026-01-01' })).status, 201);
  const [filas] = await db.query('SELECT valor, vigencia_desde, vigencia_hasta FROM tarifas WHERE concepto_id = ? ORDER BY vigencia_desde', [aguaId]);
  assert.equal(filas[0].vigencia_hasta, '2025-12-31');
  assert.equal(filas[1].vigencia_hasta, null);
  assert.equal((await tarifa({ valor: 5, vigencia_desde: '2025-06-01' })).status, 409);
  assert.equal((await tarifa({ valor: 0, vigencia_desde: '2027-01-01' })).status, 400);

  const conceptos = await request(app).get('/api/financiero/conceptos').set(auth(admin));
  assert.equal(conceptos.body.data.find((c) => c.codigo === 'AGUA_MENSUAL').tarifa_actual, 4.5);
});

test('la facturación mensual emite una cuota por comunero con lote, con la tarifa del período, una sola vez', async () => {
  const simulacion = await facturar({ anio: 2025, mes: 3, simular: true });
  assert.equal(simulacion.status, 200);
  assert.equal(simulacion.body.data.generadas, 2);
  assert.equal(simulacion.body.data.valor, 4);
  const [[{ antes }]] = await db.query('SELECT COUNT(*) AS antes FROM obligaciones WHERE periodo_anio = 2025 AND periodo_mes = 3');
  assert.equal(antes, 0, 'simular no escribe');

  const emision = await facturar({ anio: 2025, mes: 3 });
  assert.equal(emision.status, 201);
  assert.equal(emision.body.data.generadas, 2);
  assert.equal(emision.body.data.total, 8);

  const repetida = await facturar({ anio: 2025, mes: 3 });
  assert.equal(repetida.body.data.generadas, 0);
  assert.equal(repetida.body.data.existentes, 2);

  const [[cuota]] = await db.query(
    'SELECT valor, fecha_emision, fecha_vencimiento FROM obligaciones WHERE persona_id = ? AND periodo_anio = 2025 AND periodo_mes = 3',
    [comunero.personaId]
  );
  assert.equal(cuota.valor, 4);
  assert.equal(cuota.fecha_emision, '2025-03-01');
  assert.equal(cuota.fecha_vencimiento, '2025-03-31');

  assert.equal((await facturar({ anio: 2026, mes: 1 })).body.data.valor, 4.5);
  assert.equal((await facturar({ anio: 2099, mes: 1 })).status, 400);
  assert.equal((await facturar({ anio: 2024, mes: 1 })).status, 409, 'sin tarifa vigente');
});

test('el resumen de facturación muestra los 12 meses con emitidas, cobradas y pendientes', async () => {
  const res = await request(app).get('/api/financiero/facturacion/mensual?anio=2025').set(auth(admin));
  assert.equal(res.status, 200);
  assert.equal(res.body.data.anio, 2025);
  assert.equal(res.body.data.meses.length, 12);
  const marzo = res.body.data.meses[2];
  assert.deepEqual(marzo, { mes: 3, emitidas: 2, pagadas: 0, pendientes: 2, total: 8, recaudado: 0 });
  assert.equal(res.body.data.meses[0].emitidas, 0);

  assert.equal((await request(app).get('/api/financiero/facturacion/mensual').set(auth(comunero))).status, 403);
  assert.equal((await request(app).get('/api/financiero/facturacion/mensual?anio=abc').set(auth(admin))).status, 400);
});

test('el pago valida pertenencia, estado y referencia; ignora ids repetidos', async () => {
  const propia = await crearObligacion({ personaId: comunero.personaId, anio: 2024, mes: 5, valor: 4 });
  const ajena = await crearObligacion({ personaId: vecino.personaId, anio: 2024, mes: 5, valor: 4 });

  assert.equal((await pagar({ persona_id: comunero.personaId, obligacionesIds: [ajena] })).status, 400);
  assert.equal((await pagar({ persona_id: comunero.personaId, obligacionesIds: [propia], metodo: 'TRANSFERENCIA' })).status, 400);

  const ok = await pagar({ persona_id: comunero.personaId, obligacionesIds: [propia, propia] });
  assert.equal(ok.status, 201, JSON.stringify(ok.body));
  assert.equal(ok.body.valorTotal, 4);
  assert.equal((await pagar({ persona_id: comunero.personaId, obligacionesIds: [propia] })).status, 409);
});

test('anular un pago conserva su detalle, devuelve las obligaciones y permite volver a cobrarlas', async () => {
  const ob = await crearObligacion({ personaId: comunero.personaId, anio: 2024, mes: 6, valor: 4 });
  const pago = await pagar({ persona_id: comunero.personaId, obligacionesIds: [ob], observacion: 'Incluye [ANULADO: texto del usuario]' });
  const pagoId = pago.body.pagoId;

  assert.equal((await request(app).post(`/api/financiero/pagos/${pagoId}/anular`).set(auth(admin)).send({ motivo: 'x' })).status, 400);
  const anulado = await request(app).post(`/api/financiero/pagos/${pagoId}/anular`).set(auth(admin)).send({ motivo: 'Error de digitación' });
  assert.equal(anulado.status, 200);
  assert.equal((await request(app).post(`/api/financiero/pagos/${pagoId}/anular`).set(auth(admin)).send({ motivo: 'Otra vez' })).status, 409);

  const [[p]] = await db.query('SELECT estado, motivo_anulacion FROM pagos WHERE id = ?', [pagoId]);
  assert.equal(p.estado, 'ANULADO');
  const [detalles] = await db.query('SELECT obligacion_id FROM pago_detalles WHERE pago_id = ?', [pagoId]);
  assert.equal(detalles.length, 1, 'el detalle queda como historial');

  const nuevo = await pagar({ persona_id: comunero.personaId, obligacionesIds: [ob] });
  assert.equal(nuevo.status, 201);
});

test('un texto "[ANULADO:" en la observación ya no saca el pago del balance', async () => {
  const antes = (await request(app).get('/api/financiero/balance').set(auth(admin))).body.balance.totalIngresos;
  const ob = await crearObligacion({ personaId: vecino.personaId, anio: 2024, mes: 7, valor: 10 });
  await pagar({ persona_id: vecino.personaId, obligacionesIds: [ob], observacion: 'Nota [ANULADO: no aplica]' });
  const despues = (await request(app).get('/api/financiero/balance').set(auth(admin))).body.balance.totalIngresos;
  assert.equal(despues, antes + 10);
});

test('el balance respeta el rango de fechas en ingresos y egresos', async () => {
  const egreso = await request(app).post('/api/financiero/egresos').set(auth(admin)).send({
    fecha: '2025-02-10', concepto: 'Compra de tubería PVC', proveedor: 'Ferretería Patate', ruc_proveedor: '1891234567001', valor: 120.5
  });
  assert.equal(egreso.status, 201, JSON.stringify(egreso.body));
  const fuera = await request(app).get('/api/financiero/balance?desde=2025-03-01&hasta=2025-03-31').set(auth(admin));
  assert.equal(fuera.body.balance.totalEgresos, 0);
  const dentro = await request(app).get('/api/financiero/balance?desde=2025-02-01&hasta=2025-02-28').set(auth(admin));
  assert.equal(dentro.body.balance.totalEgresos, 120.5);
  assert.equal((await request(app).get('/api/financiero/balance?desde=2025-03-01&hasta=2025-01-01').set(auth(admin))).status, 400);
  assert.equal((await request(app).post('/api/financiero/egresos').set(auth(admin)).send({ fecha: '2999-01-01', concepto: 'Futuro', valor: 1 })).status, 400);
});

test('solo se anulan obligaciones pendientes', async () => {
  const ob = await crearObligacion({ personaId: vecino.personaId, anio: 2024, mes: 8 });
  const anular = () => request(app).post(`/api/financiero/obligaciones/${ob}/anular`).set(auth(admin)).send({ motivo: 'Exonerado por asamblea' });
  assert.equal((await anular()).status, 200);
  assert.equal((await anular()).status, 409);
});

test('una obligación manual duplicada en el mismo período devuelve 409', async () => {
  const cuerpo = { persona_id: vecino.personaId, concepto_id: aguaId, periodo_anio: 2023, periodo_mes: 1, fecha_emision: '2023-01-01', valor: 3 };
  assert.equal((await request(app).post('/api/financiero/obligaciones').set(auth(admin)).send(cuerpo)).status, 201);
  assert.equal((await request(app).post('/api/financiero/obligaciones').set(auth(admin)).send(cuerpo)).status, 409);
});

test('mensualidades y multas se separan por código de concepto, no por id', async () => {
  const multa = await crearObligacion({ personaId: comunero.personaId, codigo: 'MULTA_MINGA', anio: 2025, mes: null, valor: 10 });
  const mensual = await request(app).get(`/api/financiero/obligaciones/mensualidades?cedula=${comunero.cedula}&anio=2025`).set(auth(admin));
  const multas = await request(app).get(`/api/financiero/obligaciones/multas?cedula=${comunero.cedula}&anio=2025`).set(auth(admin));
  assert.ok(mensual.body.data.every((o) => o.concepto_codigo === 'AGUA_MENSUAL'));
  assert.deepEqual(multas.body.data.map((o) => o.id), [multa]);
});

test('el comprobante de un pago solo lo ve su dueño o el administrador', async () => {
  const ob = await crearObligacion({ personaId: comunero.personaId, anio: 2024, mes: 9, valor: 4 });
  const { pagoId } = (await pagar({ persona_id: comunero.personaId, obligacionesIds: [ob] })).body;
  const propio = await request(app).get(`/api/financiero/pagos/${pagoId}`).set(auth(comunero));
  assert.equal(propio.status, 200);
  assert.equal(propio.body.data.detalles.length, 1);
  assert.equal((await request(app).get(`/api/financiero/pagos/${pagoId}`).set(auth(vecino))).status, 404);
});

test('el dashboard entrega indicadores reales', async () => {
  const res = await request(app).get('/api/dashboard/resumen').set(auth(admin));
  assert.equal(res.status, 200);
  assert.equal(res.body.data.fecha, hoy());
  assert.equal(res.body.data.comunidad.lotes, 2);
  assert.equal(res.body.data.comunidad.comunerosActivos, 4);
  assert.ok(res.body.data.finanzas.carteraPendiente > 0);
  assert.equal((await request(app).get('/api/dashboard/resumen').set(auth(comunero))).status, 403);
});
