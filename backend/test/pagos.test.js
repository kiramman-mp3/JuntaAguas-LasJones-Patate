const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function crearEntornoPagos({ reqBody = {} } = {}) {
  const operaciones = [];
  const connection = {
    beginTransaction: async () => operaciones.push('BEGIN'),
    commit: async () => operaciones.push('COMMIT'),
    rollback: async () => operaciones.push('ROLLBACK'),
    release: () => operaciones.push('RELEASE'),
    query: async (sql, params) => {
      operaciones.push({ sql, params });
      if (sql.includes('FROM obligaciones')) {
        return [[{ id: 101, persona_id: 1, valor: '15.00', estado: 'PENDIENTE' }]];
      }
      if (sql.includes('INSERT INTO pagos')) {
        return [{ insertId: 50 }];
      }
      return [{ affectedRows: 1 }];
    }
  };

  const auditorias = [];
  const context = {
    module: { exports: {} },
    require: nombre => {
      if (nombre === '../config/db') {
        return {
          getConnection: async () => connection,
          query: async (sql, params) => {
            operaciones.push({ sql, params });
            return [[]];
          }
        };
      }
      if (nombre === '../services/auditService') {
        return {
          registrarAuditoria: async (data) => auditorias.push(data)
        };
      }
      throw new Error(`Modulo mock no configurado: ${nombre}`);
    }
  };

  const controllerCode = fs.readFileSync(path.join(__dirname, '../src/controllers/financieroController.js'), 'utf8');
  vm.runInNewContext(controllerCode, context);

  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };

  const req = {
    body: {
      persona_id: 1,
      metodo: 'EFECTIVO',
      obligacionesIds: [101],
      ...reqBody
    },
    user: { cuentaId: 99 },
    ip: '127.0.0.1'
  };

  return { api: context.module.exports, req, res, operaciones, auditorias };
}

const siguiente = error => { if (error) throw error; };

test('registrarPago persiste correctamente el campo "observacion" cuando se envia en el payload', async () => {
  const e = crearEntornoPagos({
    reqBody: { observacion: 'Pago de cuota anual 2026' }
  });

  await e.api.registrarPago(e.req, e.res, siguiente);

  assert.equal(e.res.statusCode, 201);
  assert.equal(e.res.body.status, 'OK');
  assert.equal(e.res.body.pagoId, 50);

  const insertPago = e.operaciones.find(o => o.sql?.includes('INSERT INTO pagos'));
  assert.ok(insertPago, 'Debe ejecutarse el INSERT INTO pagos');
  // Parametros: [persona_id, valorTotal, metodo, referencia, textoObservacion, cuentaId]
  assert.equal(insertPago.params[4], 'Pago de cuota anual 2026');
  assert.equal(e.auditorias[0].detalle.observacion, 'Pago de cuota anual 2026');
  assert.ok(e.operaciones.includes('COMMIT'));
});

test('registrarPago acepta "observaciones" por retrocompatibilidad y lo almacena como observacion', async () => {
  const e = crearEntornoPagos({
    reqBody: { observaciones: 'Pago procesado desde ventanilla' }
  });

  await e.api.registrarPago(e.req, e.res, siguiente);

  assert.equal(e.res.statusCode, 201);
  const insertPago = e.operaciones.find(o => o.sql?.includes('INSERT INTO pagos'));
  assert.ok(insertPago);
  assert.equal(insertPago.params[4], 'Pago procesado desde ventanilla');
  assert.equal(e.auditorias[0].detalle.observacion, 'Pago procesado desde ventanilla');
});

test('registrarPago prioriza "observacion" sobre "observaciones" y normaliza cadenas con espacios', async () => {
  const e = crearEntornoPagos({
    reqBody: {
      observacion: '   Aporte prioritario   ',
      observaciones: 'Texto secundario'
    }
  });

  await e.api.registrarPago(e.req, e.res, siguiente);

  assert.equal(e.res.statusCode, 201);
  const insertPago = e.operaciones.find(o => o.sql?.includes('INSERT INTO pagos'));
  assert.equal(insertPago.params[4], 'Aporte prioritario');
});

test('registrarPago asigna null cuando ambos campos vienen vacios o con espacios en blanco', async () => {
  const e = crearEntornoPagos({
    reqBody: { observacion: '   ', observaciones: '' }
  });

  await e.api.registrarPago(e.req, e.res, siguiente);

  assert.equal(e.res.statusCode, 201);
  const insertPago = e.operaciones.find(o => o.sql?.includes('INSERT INTO pagos'));
  assert.equal(insertPago.params[4], null);
});
