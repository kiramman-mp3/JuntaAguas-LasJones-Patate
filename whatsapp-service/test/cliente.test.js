const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { navegador } = require('../src/cliente');

test('CHROME_BIN tiene prioridad si el archivo existe', () => {
  const propio = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'wa-nav-')), 'navegador.exe');
  fs.writeFileSync(propio, '');
  assert.equal(navegador(propio), propio);
});

test('un CHROME_BIN inexistente se ignora y se busca un navegador instalado', () => {
  const instalado = navegador(null);
  assert.equal(navegador(path.join(os.tmpdir(), 'no-existe', 'chrome.exe')), instalado);
});
