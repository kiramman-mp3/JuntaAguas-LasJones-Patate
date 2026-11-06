const fs = require('fs');
const os = require('os');
const path = require('path');

// El frontend compilado se simula con una carpeta que solo tiene un index.html. Debe definirse antes de
// cargar testEnv: la configuración se lee una sola vez, al primer require.
const dist = fs.mkdtempSync(path.join(os.tmpdir(), 'junta-dist-'));
fs.writeFileSync(path.join(dist, 'index.html'), '<!doctype html><title>Junta</title>');
process.env.FRONTEND_DIST = dist;

const { resetDatabase, closeDatabase } = require('../helpers/testEnv');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

const request = require('supertest');
const app = require('../../src/app');

before(resetDatabase);
after(closeDatabase);

test('las rutas de Angular devuelven la aplicación con GET y con HEAD', async () => {
  for (const ruta of ['/', '/admin/cobros/cobrar', '/noticias/12']) {
    const get = await request(app).get(ruta);
    assert.equal(get.status, 200, ruta);
    assert.match(get.text, /<title>Junta<\/title>/);
    assert.equal(get.headers['cache-control'], 'no-cache');
    assert.equal((await request(app).head(ruta)).status, 200, `HEAD ${ruta}`);
  }
});

test('la API y los archivos inexistentes no devuelven la aplicación', async () => {
  assert.equal((await request(app).get('/api/no-existe')).status, 404);
  assert.equal((await request(app).head('/api/no-existe')).status, 404);
  assert.equal((await request(app).get('/main-inexistente.js')).status, 404);
  assert.equal((await request(app).post('/admin')).status, 404);
});
