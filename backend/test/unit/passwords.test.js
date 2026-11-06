const { test } = require('node:test');
const assert = require('node:assert/strict');
const { problemaConPassword, generarPasswordTemporal } = require('../../src/shared/passwords');

test('la contraseña exige 10 caracteres con letras y números', () => {
  assert.match(problemaConPassword('Corta1'), /al menos 10/);
  assert.match(problemaConPassword('123456789a'.slice(0, 9)), /al menos 10/);
  assert.match(problemaConPassword('soloLetrasAqui'), /letras y números/);
  assert.match(problemaConPassword('12345678901'), /letras y números/);
  assert.equal(problemaConPassword('Riego-Patate-2026'), null);
  assert.match(problemaConPassword('a'.repeat(73) + '1'), /72/);
});

test('rechaza contraseñas comunes aunque lleven números o símbolos', () => {
  for (const clave of ['password123', 'Password1234', 'Qwerty12345', 'Junta2026!!', 'LaJones-2026', 'admin12345', 'Patate2026']) {
    assert.match(problemaConPassword(clave) ?? '', /demasiado común/, clave);
  }
  assert.equal(problemaConPassword('Canal-Matriz-0417'), null);
});

test('rechaza una contraseña que contiene la cédula', () => {
  assert.match(problemaConPassword('xyz1803456789abc', { cedula: '1803456789' }), /cédula/);
});

test('las contraseñas temporales generadas cumplen la política', () => {
  for (let i = 0; i < 200; i++) assert.equal(problemaConPassword(generarPasswordTemporal()), null);
});
