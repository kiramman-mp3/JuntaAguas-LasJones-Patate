const { test } = require('node:test');
const assert = require('node:assert/strict');
const s = require('../../src/shared/schemas');

test('money accepts numbers and plain decimal strings', () => {
  for (const [entrada, esperado] of [[10, 10], ['10.50', 10.5], [' 7 ', 7], [0.01, 0.01]]) {
    const r = s.montoPositivo.safeParse(entrada);
    assert.equal(r.success, true, `debería aceptar ${JSON.stringify(entrada)}`);
    assert.equal(r.data, esperado);
  }
});

test('money rejects booleans, hex, exponent, empty and non-numeric values', () => {
  for (const entrada of [true, false, '0x10', '1e3', '', '  ', null, undefined, 'abc', [], {}, 'Infinity', NaN]) {
    assert.equal(s.montoPositivo.safeParse(entrada).success, false, `debería rechazar ${JSON.stringify(entrada)}`);
  }
});

test('money keeps its range and decimal rules', () => {
  assert.equal(s.montoPositivo.safeParse(0).success, false);
  assert.equal(s.montoPositivo.safeParse(-5).success, false);
  assert.equal(s.montoPositivo.safeParse('-5').success, false);
  assert.equal(s.montoPositivo.safeParse(10.999).success, false);
  assert.equal(s.montoPositivo.safeParse(1000000.01).success, false);
  assert.equal(s.montoPositivo.safeParse(1000000).success, true);
});

test('dineroCon applies the field-specific limits and works with optional()', () => {
  const valorUnitario = s.dineroCon((n) => n.min(0, 'negativo').max(100)).optional();
  assert.equal(valorUnitario.safeParse(undefined).success, true);
  assert.equal(valorUnitario.safeParse(0).success, true);
  assert.equal(valorUnitario.safeParse(-1).success, false);
  assert.equal(valorUnitario.safeParse(101).success, false);
  assert.equal(valorUnitario.safeParse(true).success, false);
});

test('birth date must belong to an adult and be after 1900', () => {
  const limite = s.fechaMaximaNacimiento();
  const [a, m, d] = limite.split('-');
  const siguiente = new Date(Date.UTC(Number(a), Number(m) - 1, Number(d) + 1)).toISOString().slice(0, 10);
  const anterior = new Date(Date.UTC(Number(a), Number(m) - 1, Number(d) - 1)).toISOString().slice(0, 10);

  assert.equal(s.fechaNacimientoOpcional.safeParse(limite).success, true, 'cumple 18 años hoy');
  assert.equal(s.fechaNacimientoOpcional.safeParse(anterior).success, true);
  assert.equal(s.fechaNacimientoOpcional.safeParse(siguiente).success, false, 'cumple 18 años mañana');
  assert.equal(s.fechaNacimientoOpcional.safeParse('2099-01-01').success, false);
  assert.equal(s.fechaNacimientoOpcional.safeParse('1899-12-31').success, false);
  assert.equal(s.fechaNacimientoOpcional.safeParse('1900-01-01').success, true);
  assert.equal(s.fechaNacimientoOpcional.safeParse('2026-02-30').success, false);
  assert.equal(s.fechaNacimientoOpcional.safeParse('').data, null);
  assert.equal(s.fechaNacimientoOpcional.safeParse(undefined).data, null);
});

test('the 18-year limit follows the Ecuador calendar day', () => {
  assert.equal(s.fechaMaximaNacimiento(new Date('2026-11-06T12:00:00Z')), '2008-11-06');
  // 02:00 UTC del 7 es todavía el 6 en Ecuador (UTC-5).
  assert.equal(s.fechaMaximaNacimiento(new Date('2026-11-07T02:00:00Z')), '2008-11-06');
});
