const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function crearEntornoBalance({ ingresos, egresos }) {
  const db = {
    query: async sql => {
      if (sql.includes('total_ingresos FROM pagos')) {
        return [[{ total_ingresos: ingresos }]];
      }
      if (sql.includes('total_egresos FROM egresos')) {
        return [[{ total_egresos: egresos }]];
      }
      if (sql.includes('total_pendientes FROM obligaciones')) {
        return [[{ total_pendientes: '0.00' }]];
      }
      if (sql.includes('DATE_FORMAT(fecha')) {
        return [[]];
      }
      throw new Error(`Consulta no configurada en el mock: ${sql}`);
    }
  };
  const context = {
    module: { exports: {} },
    require: nombre => {
      if (nombre === '../config/db') return db;
      if (nombre === '../services/auditService') {
        return { registrarAuditoria: async () => {} };
      }
      throw new Error(`Modulo mock no configurado: ${nombre}`);
    }
  };

  const controllerCode = fs.readFileSync(
    path.join(__dirname, '../src/controllers/financieroController.js'),
    'utf8'
  );
  vm.runInNewContext(controllerCode, context);

  return {
    api: context.module.exports,
    req: { query: {} },
    res: { json(body) { this.body = body; return this; } }
  };
}

test('getBalanceReport resta importes en centavos para evitar errores de precisión', async () => {
  const casos = [
    { ingresos: '0.30', egresos: '0.20', esperado: 0.1 },
    { ingresos: '0.10', egresos: '0.30', esperado: -0.2 },
    { ingresos: '90071992547409.91', egresos: '90071992547409.90', esperado: 0.01 },
    { ingresos: '15.00', egresos: '15.00', esperado: 0 }
  ];

  for (const caso of casos) {
    const entorno = crearEntornoBalance(caso);
    await entorno.api.getBalanceReport(entorno.req, entorno.res, error => {
      if (error) throw error;
    });
    assert.equal(entorno.res.body.balance.balanceAlDia, caso.esperado);
  }
});
