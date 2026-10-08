const { test } = require('node:test');
const assert = require('node:assert/strict');
const { hoy, horaActual, normalizarHora, esFechaValida, fechaLarga, yaOcurrio } = require('../../src/shared/dates');

test('la fecha local de la Junta usa la hora de Ecuador, no UTC', () => {
  // 03:00 UTC del 7 de octubre son las 22:00 del 6 de octubre en Ecuador.
  const instante = new Date('2026-10-07T03:00:00Z');
  assert.equal(hoy(instante), '2026-10-06');
  assert.equal(horaActual(instante), '22:00:00');
});

test('un evento de mañana no se considera ocurrido aunque en UTC ya sea mañana', () => {
  const nocheEnEcuador = new Date('2026-10-07T03:00:00Z');
  assert.equal(yaOcurrio('2026-10-07', '08:00', nocheEnEcuador), false);
  assert.equal(yaOcurrio('2026-10-06', '21:00', nocheEnEcuador), true);
  assert.equal(yaOcurrio('2026-10-06', '23:00', nocheEnEcuador), false);
});

test('normaliza horas y valida fechas reales', () => {
  assert.equal(normalizarHora('9:05'), '09:05:00');
  assert.equal(normalizarHora('18:30:15'), '18:30:15');
  assert.equal(normalizarHora('24:00'), null);
  assert.equal(normalizarHora('9h00'), null);
  assert.equal(esFechaValida('2026-02-28'), true);
  assert.equal(esFechaValida('2026-02-30'), false);
});

test('escribe la fecha larga del mismo día de calendario, sin desfase de zona horaria', () => {
  assert.equal(fechaLarga('2026-10-10'), 'sábado, 10 de octubre de 2026');
  assert.equal(fechaLarga('2026-01-01'), 'jueves, 1 de enero de 2026');
});
