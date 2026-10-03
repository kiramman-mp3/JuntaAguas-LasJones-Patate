const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function entorno({ evento = {}, query } = {}) {
  const minga = { id: 1, tipo: 'MINGA', estado: 'CONVOCADO', iniciada: 1,
    fecha_iso: '2020-01-01', titulo: 'Canal', genera_multa_ausencia: 1, valor_multa: '10.00', ...evento };
  const operaciones = [];
  const connection = {
    beginTransaction: async () => operaciones.push('BEGIN'),
    commit: async () => operaciones.push('COMMIT'),
    rollback: async () => operaciones.push('ROLLBACK'),
    release: () => operaciones.push('RELEASE'),
    query: async (sql, params) => {
      operaciones.push({ sql, params });
      if (query) { const resultado = query(sql, params); if (resultado) return resultado; }
      if (sql.includes('FROM eventos e')) return [[minga]];
      if (sql.includes('FROM conceptos_cobro')) return [[{ id: 3 }]];
      if (sql.includes('FROM obligaciones')) return [[]];
      if (sql.includes('FROM asistencias')) return [[{ persona_id: 10 }]];
      return [{ affectedRows: 1 }];
    }
  };
  const context = { module: { exports: {} }, require: nombre => {
    if (nombre === '../config/db') return { getConnection: async () => connection,
      query: async () => [[{ tipo: minga.tipo }]] };
    if (nombre === '../services/auditService') return { registrarAuditoria: async () => {} };
    throw new Error(nombre);
  }};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/controllers/mingaController.js'), 'utf8'), context);
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  const req = { params: { id: '1' }, body: {}, user: { cuentaId: 1 }, ip: '127.0.0.1' };
  return { api: context.module.exports, req, res, operaciones };
}

const siguiente = error => { if (error) throw error; };

test('finaliza una Minga y registra la multa en la misma transacción', async () => {
  const e = entorno();
  await e.api.finalizar(e.req, e.res, siguiente);
  assert.equal(e.res.body.estado, 'REALIZADO');
  assert.equal(e.res.body.multasGeneradas, 1);
  const insert = e.operaciones.find(o => o.sql?.includes('INSERT INTO obligaciones'));
  assert.ok(insert.sql.includes('NULL'));
  assert.equal(insert.params[2], 1);
  assert.ok(e.operaciones.includes('COMMIT'));
});

test('no modifica Asambleas desde los endpoints de Mingas', async () => {
  const e = entorno({ evento: { tipo: 'ASAMBLEA' } });
  await e.api.finalizar(e.req, e.res, siguiente);
  assert.equal(e.res.statusCode, 400);
  assert.ok(!e.operaciones.some(o => o.sql?.startsWith('UPDATE')));
  assert.ok(e.operaciones.includes('ROLLBACK'));
});

test('finalizar nuevamente no genera ni modifica multas', async () => {
  const e = entorno({ evento: { estado: 'REALIZADO' } });
  await e.api.finalizar(e.req, e.res, siguiente);
  assert.equal(e.res.body.yaFinalizada, true);
  assert.equal(e.res.body.multasGeneradas, 0);
  assert.ok(!e.operaciones.some(o => o.sql?.includes('INSERT')));
});

test('rechaza finalización futura o cancelada', async () => {
  for (const evento of [{ iniciada: 0 }, { estado: 'CANCELADO' }]) {
    const e = entorno({ evento });
    await e.api.finalizar(e.req, e.res, siguiente);
    assert.equal(e.res.statusCode, 409);
    assert.ok(!e.operaciones.some(o => o.sql?.includes('INSERT')));
  }
});

test('permite programar y cancelar, pero no retroceder una convocatoria', async () => {
  const e = entorno({ evento: { estado: 'BORRADOR' } });
  e.req.body.estado = 'PROGRAMADO';
  await e.api.cambiarEstado(e.req, e.res, siguiente);
  assert.equal(e.res.body.estado, 'PROGRAMADO');
  const retroceso = entorno();
  retroceso.req.body.estado = 'PROGRAMADO';
  await retroceso.api.cambiarEstado(retroceso.req, retroceso.res, siguiente);
  assert.equal(retroceso.res.statusCode, 409);
});

test('el fallo de inserción revierte toda la finalización', async () => {
  const e = entorno({ query: sql => { if (sql.includes('INSERT INTO obligaciones')) throw new Error('Fallo de BD'); } });
  let error;
  await e.api.finalizar(e.req, e.res, fallo => { error = fallo; });
  assert.equal(error.message, 'Fallo de BD');
  assert.ok(e.operaciones.includes('ROLLBACK'));
  assert.ok(!e.operaciones.includes('COMMIT'));
});

test('bloquea cambios de asistencia en una Minga finalizada', async () => {
  const e = entorno({ evento: { estado: 'REALIZADO' } });
  e.req.body.asistencias = [{ persona_id: 10, estado: 'PRESENTE' }];
  await e.api.registrarAsistencias(e.req, e.res, siguiente);
  assert.equal(e.res.statusCode, 409);
  assert.ok(!e.operaciones.some(o => o.sql?.includes('INSERT')));
});

test('rechaza registros repetidos o justificaciones vacías antes de escribir', async () => {
  for (const asistencias of [[{ persona_id: 10, estado: 'JUSTIFICADO' }],
    [{ persona_id: 10, estado: 'PRESENTE' }, { persona_id: 10, estado: 'AUSENTE' }]]) {
    const e = entorno(); e.req.body.asistencias = asistencias;
    await e.api.registrarAsistencias(e.req, e.res, siguiente);
    assert.equal(e.res.statusCode, 400);
    assert.ok(!e.operaciones.some(o => o.sql?.includes('INSERT')));
  }
});

test('el contrato anterior de Asambleas conserva su controlador', async () => {
  const e = entorno({ evento: { tipo: 'ASAMBLEA' } });
  let continua = false;
  await e.api.encaminarAsistencias(e.req, e.res, () => { continua = true; });
  assert.equal(continua, true);
  assert.deepEqual(e.operaciones, []);
});
