const { resetDatabase, closeDatabase } = require('../helpers/testEnv');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const app = require('../../src/app');
const db = require('../../src/config/db');
const { conectarBase } = require('../../src/db/connection');
const { sembrar } = require('../../src/db/seed');
const { esCedulaValida } = require('../../src/shared/schemas');

const HOY = '2026-03-15';
const PASSWORD = 'Semilla2026';
let resultado;

before(async () => {
  await resetDatabase();
  const conexion = await conectarBase(process.env.DB_NAME);
  try {
    resultado = await sembrar(conexion, { hoy: HOY, totalUsuarios: 25, meses: 14, password: PASSWORD, log: () => {} });
  } finally {
    await conexion.end();
  }
});
after(closeDatabase);

const uno = async (sql, params) => (await db.query(sql, params))[0][0];

test('los usuarios tienen cédulas ecuatorianas válidas y únicas', async () => {
  const [personas] = await db.query('SELECT cedula FROM personas');
  assert.equal(personas.length, resultado.usuarios);
  assert.ok(personas.every((p) => esCedulaValida(p.cedula)));
});

test('el pago anual de cada año usa la tarifa AGUA_ANUAL vigente al 1 de enero y no hay cuotas mensuales', async () => {
  const [tarifas] = await db.query(
    "SELECT t.valor, t.vigencia_desde, t.vigencia_hasta FROM tarifas t JOIN conceptos_cobro c ON c.id = t.concepto_id AND c.codigo = 'AGUA_ANUAL' ORDER BY t.vigencia_desde"
  );
  assert.equal(tarifas.length, 2);
  assert.equal(tarifas[0].vigencia_hasta, '2025-05-31');
  const fueraDeTarifa = await uno(
    `SELECT COUNT(*) AS n FROM obligacion_anual_agua o
     JOIN conceptos_cobro c ON c.codigo = 'AGUA_ANUAL'
     JOIN tarifas t ON t.concepto_id = c.id AND MAKEDATE(o.periodo_anio, 1) BETWEEN t.vigencia_desde AND COALESCE(t.vigencia_hasta, '9999-12-31')
     WHERE o.valor_total <> t.valor`
  );
  assert.equal(fueraDeTarifa.n, 0);
  assert.ok(resultado.obligacionesAnuales > 0);
  const mensuales = await uno(
    "SELECT COUNT(*) AS n FROM obligaciones o JOIN conceptos_cobro c ON c.id = o.concepto_id AND c.codigo = 'AGUA_MENSUAL'"
  );
  assert.equal(mensuales.n, 0);
});

test('los pagos son coherentes con sus obligaciones y nunca están en el futuro', async () => {
  assert.equal((await uno(
    'SELECT COUNT(*) AS n FROM pagos p WHERE valor_total <> (SELECT SUM(valor_pagado) FROM pago_detalles d WHERE d.pago_id = p.id)'
  )).n, 0);
  assert.equal((await uno(
    `SELECT COUNT(*) AS n FROM obligaciones o WHERE estado = 'PAGADA' AND NOT EXISTS
       (SELECT 1 FROM pago_detalles d JOIN pagos p ON p.id = d.pago_id AND p.estado = 'VIGENTE' WHERE d.obligacion_id = o.id)`
  )).n, 0);
  assert.equal((await uno(
    `SELECT COUNT(*) AS n FROM pago_detalles d JOIN pagos p ON p.id = d.pago_id JOIN obligaciones o ON o.id = d.obligacion_id
     WHERE DATE(p.fecha_pago) < o.fecha_emision`
  )).n, 0);
  assert.equal((await uno('SELECT COUNT(*) AS n FROM pagos WHERE fecha_pago > UTC_TIMESTAMP()')).n, 0);
  assert.equal((await uno("SELECT COUNT(*) AS n FROM pagos WHERE estado = 'ANULADO'")).n, resultado.anulaciones);
  assert.ok((await uno("SELECT COUNT(*) AS n FROM obligaciones WHERE estado = 'PENDIENTE'")).n > 0, 'debe quedar cartera pendiente');
});

test('el pago anual de agua tiene una obligación por usuario activo y año, y sus pagos son coherentes', async () => {
  const [anios] = await db.query('SELECT periodo_anio AS anio, COUNT(*) AS total FROM obligacion_anual_agua GROUP BY periodo_anio ORDER BY anio');
  assert.deepEqual(anios.map((a) => a.anio), [2025, 2026], 'no se emiten años futuros');
  const sinLote = await uno(
    'SELECT COUNT(*) AS c FROM obligacion_anual_agua o WHERE NOT EXISTS (SELECT 1 FROM persona_lotes pl WHERE pl.persona_id = o.persona_id)'
  );
  assert.equal(sinLote.c, 0, 'solo pagan agua los usuarios con lote');
  const { c: conLote } = await uno(
    "SELECT COUNT(DISTINCT p.id) AS c FROM personas p JOIN persona_lotes pl ON pl.persona_id = p.id WHERE p.estado = 'ACTIVO'"
  );
  assert.ok(anios.at(-1).total >= conLote, 'cada usuario activo con lote tiene su obligación del año');

  const huerfanas = await uno(
    `SELECT COUNT(*) AS c FROM obligacion_anual_agua o
     LEFT JOIN pago_anual_agua_detalle d ON d.obligacion_anual_agua = o.id
     WHERE (o.estado = 'PAGADO') <> (d.id IS NOT NULL)`
  );
  assert.equal(huerfanas.c, 0, 'toda obligación pagada tiene su detalle y viceversa');

  const antesDeEmitir = await uno(
    `SELECT COUNT(*) AS c FROM pago_anual_agua_detalle d JOIN pago_anual_agua p ON p.id = d.pago_anual_agua_id
     JOIN obligacion_anual_agua o ON o.id = d.obligacion_anual_agua WHERE p.fecha_pago < o.fecha_emision`
  );
  assert.equal(antesDeEmitir.c, 0, 'ningún pago es anterior a la emisión');
  // fecha_pago está en UTC: el día de hoy en Ecuador termina a las 05:00 UTC del día siguiente.
  const enElFuturo = await uno('SELECT COUNT(*) AS c FROM pago_anual_agua WHERE fecha_pago >= ?', ['2026-03-16 05:00:00']);
  assert.equal(enElFuturo.c, 0);
  assert.ok(resultado.anualAgua.pagos > 0);
});

test('los eventos pasados están finalizados con su asistencia completa y sus multas', async () => {
  assert.equal((await uno("SELECT COUNT(*) AS n FROM eventos WHERE fecha < ? AND estado NOT IN ('REALIZADO', 'CANCELADO')", [HOY])).n, 0);
  assert.equal((await uno("SELECT COUNT(*) AS n FROM eventos WHERE fecha >= ? AND estado IN ('REALIZADO', 'CANCELADO')", [HOY])).n, 0);
  const multas = await uno(
    `SELECT COUNT(*) AS n FROM asistencias a JOIN eventos e ON e.id = a.evento_id
     WHERE a.estado = 'AUSENTE' AND NOT EXISTS (SELECT 1 FROM obligaciones o WHERE o.evento_id = e.id AND o.persona_id = a.persona_id)`
  );
  assert.equal(multas.n, 0, 'cada ausencia genera su multa');
  assert.equal((await uno("SELECT COUNT(*) AS n FROM asistencias WHERE estado = 'PENDIENTE'")).n, 0);
  assert.equal((await uno('SELECT COUNT(*) AS n FROM obligaciones WHERE evento_id IS NOT NULL')).n, resultado.multas);
});

test('los turnos de un mismo sector no se solapan', async () => {
  const solapes = await uno(
    `SELECT COUNT(*) AS n FROM turnos_riego a
     JOIN turnos_riego b ON a.id < b.id AND a.dia_semana = b.dia_semana AND a.hora_inicio < b.hora_fin AND b.hora_inicio < a.hora_fin
     JOIN lotes la ON la.id = a.lote_id JOIN lotes lb ON lb.id = b.lote_id AND la.sector_id = lb.sector_id`
  );
  assert.equal(solapes.n, 0);
});

test('las credenciales sembradas permiten usar la API', async () => {
  const login = await request(app).post('/api/auth/login').send({ cedula: resultado.admin.cedula, password: PASSWORD });
  assert.equal(login.status, 200);
  const token = login.body.token ?? login.body.data?.token;
  const balance = await request(app).get('/api/financiero/balance').set('Authorization', `Bearer ${token}`);
  assert.equal(balance.status, 200);

  const demo = await request(app).post('/api/auth/login').send({ cedula: resultado.demo.cedula, password: PASSWORD });
  assert.equal(demo.status, 200);
});

test('no siembra sobre una base con usuarios', async () => {
  const conexion = await conectarBase(process.env.DB_NAME);
  try {
    await assert.rejects(sembrar(conexion, { hoy: HOY, password: PASSWORD, log: () => {} }), /Use --reset/);
  } finally {
    await conexion.end();
  }
});
