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
    resultado = await sembrar(conexion, { hoy: HOY, totalComuneros: 25, meses: 14, password: PASSWORD, log: () => {} });
  } finally {
    await conexion.end();
  }
});
after(closeDatabase);

const uno = async (sql, params) => (await db.query(sql, params))[0][0];

test('los comuneros tienen cédulas ecuatorianas válidas y únicas', async () => {
  const [personas] = await db.query('SELECT cedula FROM personas');
  assert.equal(personas.length, resultado.comuneros);
  assert.ok(personas.every((p) => esCedulaValida(p.cedula)));
});

test('la facturación usa la tarifa vigente de cada mes', async () => {
  const [tarifas] = await db.query("SELECT valor, vigencia_desde, vigencia_hasta FROM tarifas ORDER BY vigencia_desde");
  assert.equal(tarifas.length, 2);
  assert.equal(tarifas[0].vigencia_hasta, '2025-05-31');
  const fueraDeTarifa = await uno(
    `SELECT COUNT(*) AS n FROM obligaciones o JOIN conceptos_cobro c ON c.id = o.concepto_id AND c.codigo = 'AGUA_MENSUAL'
     JOIN tarifas t ON t.concepto_id = c.id AND o.fecha_emision BETWEEN t.vigencia_desde AND COALESCE(t.vigencia_hasta, '9999-12-31')
     WHERE o.valor <> t.valor`
  );
  assert.equal(fueraDeTarifa.n, 0);
  assert.ok(resultado.facturas > 0);
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

test('no siembra sobre una base con comuneros', async () => {
  const conexion = await conectarBase(process.env.DB_NAME);
  try {
    await assert.rejects(sembrar(conexion, { hoy: HOY, password: PASSWORD, log: () => {} }), /Use --reset/);
  } finally {
    await conexion.end();
  }
});
