const { test } = require('node:test');
const assert = require('node:assert/strict');
const { aCentavos, restarMontos } = require('../../src/shared/money');

test('resta importes en centavos para evitar errores de precisión', () => {
  const casos = [
    { ingresos: 0.3, egresos: 0.2, esperado: 0.1 },
    { ingresos: '0.10', egresos: '0.30', esperado: -0.2 },
    { ingresos: 1234567.91, egresos: 1234567.9, esperado: 0.01 },
    { ingresos: 15, egresos: '15.00', esperado: 0 }
  ];
  for (const { ingresos, egresos, esperado } of casos) {
    assert.equal(restarMontos(ingresos, egresos), esperado, `${ingresos} - ${egresos}`);
  }
});

test('convierte a centavos enteros y rechaza montos no numéricos', () => {
  assert.equal(aCentavos('4.50'), 450);
  assert.equal(aCentavos(120.5), 12050);
  assert.equal(aCentavos(0), 0);
  assert.throws(() => aCentavos('abc'), TypeError);
});
