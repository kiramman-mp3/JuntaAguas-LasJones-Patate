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

test('lee los grupos de la página sin fallar por un chat con datos incompletos', () => {
  const { gruposEnLaPagina } = require('../src/cliente');
  const roto = { id: { server: 'g.us', _serialized: 'roto@g.us' } };
  Object.defineProperty(roto, 'formattedTitle', { get() { throw new Error('r'); } });
  const chats = [
    { id: { server: 'g.us', _serialized: '1@g.us' }, formattedTitle: 'Comuneros', groupMetadata: { participants: { getModelsArray: () => [1, 2, 3] } } },
    { id: { server: 'c.us', _serialized: '593990000000@c.us' }, formattedTitle: 'Persona' },
    roto,
    { id: { server: 'g.us', _serialized: '2@g.us' }, name: 'Directiva', groupMetadata: { participants: [1, 2] } },
    { id: { server: 'g.us', _serialized: '3@g.us' } }
  ];
  global.window = { require: () => ({ Chat: { getModelsArray: () => chats } }) };
  try {
    assert.deepEqual(gruposEnLaPagina(), [
      { id: '1@g.us', nombre: 'Comuneros', participantes: 3 },
      { id: '2@g.us', nombre: 'Directiva', participantes: 2 },
      { id: '3@g.us', nombre: null, participantes: null }
    ]);
  } finally {
    delete global.window;
  }
});
