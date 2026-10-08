const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { leerConfiguracion } = require('../src/config');

const TOKEN = 'x'.repeat(32);

test('usa valores por defecto seguros', () => {
  const config = leerConfiguracion({ WHATSAPP_SERVICE_TOKEN: TOKEN });
  assert.equal(config.puerto, 3100);
  assert.equal(config.host, '127.0.0.1');
  assert.equal(config.authDir, path.resolve(__dirname, '../.wwebjs_auth'));
  assert.equal(config.chromeBin, null);
});

test('exige un token de al menos 32 caracteres y un puerto válido', () => {
  assert.throws(() => leerConfiguracion({}), /WHATSAPP_SERVICE_TOKEN/);
  assert.throws(() => leerConfiguracion({ WHATSAPP_SERVICE_TOKEN: 'corto' }), /WHATSAPP_SERVICE_TOKEN/);
  assert.throws(() => leerConfiguracion({ WHATSAPP_SERVICE_TOKEN: TOKEN, WHATSAPP_PORT: 'abc' }), /WHATSAPP_PORT/);
});
