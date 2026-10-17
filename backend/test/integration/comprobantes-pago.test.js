const { resetDatabase, closeDatabase } = require('../helpers/testEnv');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const request = require('supertest');
const app = require('../../src/app');
const db = require('../../src/config/db');
const { crearUsuario, auth, crearObligacion } = require('../helpers/fixtures');
const { rutaSegura, nombreDesdeUrl } = require('../../src/services/documentStorage');

let admin, titular, vecino, pagoId;
const pdf = Buffer.from('%PDF-1.4\nComprobante de prueba\n%%EOF');
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1]);
const endpoint = () => `/api/financiero/pagos/${pagoId}/comprobante`;
before(async () => {
  await resetDatabase();
  admin = await crearUsuario({ rol: 'ADMIN' });
  titular = await crearUsuario();
  vecino = await crearUsuario();
  const ob = await crearObligacion({ personaId: titular.personaId });
  const res = await request(app).post('/api/financiero/pagos').set(auth(admin))
    .send({ persona_id: titular.personaId, obligacionesIds: [ob], metodo: 'DEPOSITO', referencia: 'DEP-123' });
  assert.equal(res.status, 201);
  pagoId = res.body.pagoId;
});
after(closeDatabase);

test('rechaza efectivo, otros métodos y método ausente sin cobrar obligaciones', async () => {
  const ob = await crearObligacion({ personaId: titular.personaId, mes: 2 });
  for (const metodo of ['EFECTIVO', 'OTRO', undefined]) {
    const res = await request(app).post('/api/financiero/pagos').set(auth(admin))
      .send({ persona_id: titular.personaId, obligacionesIds: [ob], metodo, referencia: '123' });
    assert.equal(res.status, 400);
  }
  const [[obligacion]] = await db.query('SELECT estado FROM obligaciones WHERE id = ?', [ob]);
  assert.equal(obligacion.estado, 'PENDIENTE');
});

test('la carga requiere administrador y un pago existente', async () => {
  assert.equal((await request(app).post(endpoint()).attach('archivo', pdf, 'banco.pdf')).status, 401);
  assert.equal((await request(app).post(endpoint()).set(auth(titular)).attach('archivo', pdf, 'banco.pdf')).status, 403);
  assert.equal((await request(app).post('/api/financiero/pagos/999999/comprobante').set(auth(admin)).attach('archivo', pdf, 'banco.pdf')).status, 404);
});

test('valida archivo faltante, firma binaria y límite de 10 MB', async () => {
  assert.equal((await request(app).post(endpoint()).set(auth(admin))).status, 400);
  assert.equal((await request(app).post(endpoint()).set(auth(admin)).attach('archivo', Buffer.from('texto'), 'falso.pdf')).status, 400);
  const grande = Buffer.alloc(10 * 1024 * 1024 + 1); pdf.copy(grande);
  assert.equal((await request(app).post(endpoint()).set(auth(admin)).attach('archivo', grande, 'grande.pdf')).status, 413);
});

test('guarda y descarga solo para administrador o titular, sin exponer URL pública', async () => {
  assert.equal((await request(app).post(endpoint()).set(auth(admin)).attach('archivo', pdf, '../../banco.pdf')).status, 200);
  const [[pago]] = await db.query('SELECT comprobante_url, valor_total FROM pagos WHERE id = ?', [pagoId]);
  assert.ok(pago.comprobante_url.startsWith('/uploads/documentos/pago_comprobante_'));
  assert.equal(pago.valor_total, 4);
  for (const usuario of [admin, titular]) {
    const res = await request(app).get(endpoint()).set(auth(usuario));
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, pdf);
    assert.equal(res.headers['cache-control'], 'private, no-store');
  }
  assert.equal((await request(app).get(endpoint())).status, 401);
  assert.equal((await request(app).get(endpoint()).set(auth(vecino))).status, 404);
  assert.equal((await request(app).get(pago.comprobante_url)).status, 404);
  assert.equal((await request(app).get(pago.comprobante_url).set(auth(vecino))).status, 404);
});

test('un reemplazo inválido conserva el anterior; el válido elimina el archivo previo', async () => {
  const [[antes]] = await db.query('SELECT comprobante_url FROM pagos WHERE id = ?', [pagoId]);
  assert.equal((await request(app).post(endpoint()).set(auth(admin)).attach('archivo', Buffer.from('no'), 'falso.png')).status, 400);
  const [[sinCambio]] = await db.query('SELECT comprobante_url FROM pagos WHERE id = ?', [pagoId]);
  assert.equal(sinCambio.comprobante_url, antes.comprobante_url);
  assert.equal((await request(app).post(endpoint()).set(auth(admin)).attach('archivo', png, 'banco.png')).status, 200);
  const [[despues]] = await db.query('SELECT comprobante_url FROM pagos WHERE id = ?', [pagoId]);
  assert.notEqual(despues.comprobante_url, antes.comprobante_url);
  await assert.rejects(fs.access(rutaSegura(nombreDesdeUrl(antes.comprobante_url))));
  const res = await request(app).get(endpoint()).set(auth(titular));
  assert.equal(res.headers['content-type'], 'image/png');
  assert.deepEqual(res.body, png);
});

test('al anular conserva el comprobante para consulta y bloquea su reemplazo', async () => {
  const res = await request(app).post(`/api/financiero/pagos/${pagoId}/anular`).set(auth(admin)).send({ motivo: 'Error de registro' });
  assert.equal(res.status, 200);
  assert.equal((await request(app).post(endpoint()).set(auth(admin)).attach('archivo', pdf, 'otro.pdf')).status, 409);
  assert.equal((await request(app).get(endpoint()).set(auth(titular))).status, 200);
});

test('pagos históricos en efectivo siguen consultables y no admiten comprobantes bancarios', async () => {
  const [r] = await db.query("INSERT INTO pagos (persona_id, valor_total, metodo, estado, registrado_por_cuenta_id) VALUES (?, 5, 'EFECTIVO', 'VIGENTE', ?)", [titular.personaId, admin.cuentaId]);
  const detalle = await request(app).get(`/api/financiero/pagos/${r.insertId}`).set(auth(titular));
  assert.equal(detalle.status, 200);
  assert.equal(detalle.body.data.metodo, 'EFECTIVO');
  assert.equal((await request(app).post(`/api/financiero/pagos/${r.insertId}/comprobante`).set(auth(admin)).attach('archivo', pdf, 'banco.pdf')).status, 409);
});
