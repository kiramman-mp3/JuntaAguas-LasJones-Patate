const { resetDatabase, closeDatabase } = require('../helpers/testEnv');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const request = require('supertest');

const app = require('../../src/app');
const db = require('../../src/config/db');
const { crearUsuario, auth } = require('../helpers/fixtures');

const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');
const HTML = Buffer.from('<html><script>alert(1)</script></html>');
const DIR = path.join(process.env.UPLOADS_DIR, 'documentos');

let admin, comunero;

async function crearEvento({ estado = 'PROGRAMADO', tipo = 'ASAMBLEA' } = {}) {
  const [r] = await db.query(
    `INSERT INTO eventos (tipo, titulo, fecha, hora_inicio, estado, created_by_cuenta_id)
     VALUES (?, 'Asamblea ordinaria', '2026-12-01', '09:00', ?, ?)`,
    [tipo, estado, admin.cuentaId]
  );
  return r.insertId;
}

const subir = (eventoId, campos, archivo = PDF, nombre = 'convocatoria firmada.pdf') => {
  const req = request(app).post(`/api/eventos/${eventoId}/documentos`).set(auth(admin));
  for (const [k, v] of Object.entries(campos)) req.field(k, String(v));
  return archivo ? req.attach('archivo', archivo, nombre) : req;
};

before(async () => {
  await resetDatabase();
  admin = await crearUsuario({ rol: 'ADMIN' });
  comunero = await crearUsuario();
});
after(closeDatabase);

test('guarda un PDF válido con un nombre generado por el servidor', async () => {
  const eventoId = await crearEvento();
  const res = await subir(eventoId, { tipo: 'CONVOCATORIA' });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.match(res.body.url, /^\/uploads\/documentos\/convocatoria_[0-9a-f-]{36}\.pdf$/);
  assert.equal(res.body.nombre_archivo, 'convocatoria firmada.pdf');
  assert.ok(fs.existsSync(path.join(DIR, path.basename(res.body.url))));
});

test('rechaza archivos que no son PDF o imagen aunque digan .pdf', async () => {
  const eventoId = await crearEvento();
  const res = await subir(eventoId, { tipo: 'CONVOCATORIA' }, HTML, 'acta.pdf');
  assert.equal(res.status, 400);
});

test('no permite rutas en los campos del formulario (path traversal)', async () => {
  const eventoId = await crearEvento();
  const antes = fs.existsSync(DIR) ? fs.readdirSync(DIR).length : 0;
  const punto = await subir(eventoId, { tipo: 'ACTA', punto_id: '../../../../src/controllers/x' });
  assert.equal(punto.status, 400);
  const tipo = await subir(eventoId, { tipo: '../../x' });
  assert.equal(tipo.status, 400);
  const despues = fs.existsSync(DIR) ? fs.readdirSync(DIR).length : 0;
  assert.equal(despues, antes, 'no debe escribirse ningún archivo');
});

test('exige archivo, evento existente y un punto del mismo evento', async () => {
  const eventoId = await crearEvento();
  assert.equal((await subir(eventoId, { tipo: 'ACTA' }, null)).status, 400);
  assert.equal((await subir(99999, { tipo: 'ACTA' })).status, 404);
  const otro = await crearEvento();
  const [p] = await db.query("INSERT INTO puntos_asamblea (evento_id, orden, punto_tratar) VALUES (?, 1, 'Informe')", [otro]);
  assert.equal((await subir(eventoId, { tipo: 'ACTA', punto_id: p.insertId })).status, 404);
});

test('rechaza archivos de más de 10 MB', async () => {
  const eventoId = await crearEvento();
  const grande = Buffer.concat([PDF, Buffer.alloc(10 * 1024 * 1024 + 1)]);
  assert.equal((await subir(eventoId, { tipo: 'ACTA' }, grande)).status, 413);
});

test('al reemplazar un documento se elimina el archivo anterior', async () => {
  const eventoId = await crearEvento();
  const primero = await subir(eventoId, { tipo: 'ACTA' });
  const segundo = await subir(eventoId, { tipo: 'ACTA' });
  assert.equal(segundo.status, 200);
  assert.ok(!fs.existsSync(path.join(DIR, path.basename(primero.body.url))));
  assert.ok(fs.existsSync(path.join(DIR, path.basename(segundo.body.url))));
  const lista = await request(app).get(`/api/eventos/${eventoId}/documentos`).set(auth(admin));
  assert.equal(lista.status, 200);
  assert.equal(lista.body.data.length, 1);
});

test('acceso a documentos según su tipo', async () => {
  const anunciado = await crearEvento({ estado: 'CONVOCADO' });
  const borrador = await crearEvento({ estado: 'BORRADOR' });
  const convocatoria = (await subir(anunciado, { tipo: 'CONVOCATORIA' })).body.url;
  const convocatoriaBorrador = (await subir(borrador, { tipo: 'CONVOCATORIA' })).body.url;
  const acta = (await subir(anunciado, { tipo: 'ACTA' })).body.url;
  const lista = (await subir(anunciado, { tipo: 'OTRO' })).body.url;

  const publica = await request(app).get(convocatoria);
  assert.equal(publica.status, 200);
  assert.equal(publica.headers['content-type'], 'application/pdf');
  assert.equal(publica.headers['x-content-type-options'], 'nosniff');

  assert.equal((await request(app).get(convocatoriaBorrador)).status, 401);
  assert.equal((await request(app).get(acta)).status, 401);
  assert.equal((await request(app).get(acta).set(auth(comunero))).status, 200);
  assert.equal((await request(app).get(lista).set(auth(comunero))).status, 403);
  assert.equal((await request(app).get(lista).set(auth(admin))).status, 200);
});

test('no sirve archivos no registrados ni nombres con rutas', async () => {
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(path.join(DIR, 'huerfano.pdf'), PDF);
  assert.equal((await request(app).get('/uploads/documentos/huerfano.pdf').set(auth(admin))).status, 404);
  assert.equal((await request(app).get('/uploads/documentos/..%2F..%2Fpackage.json').set(auth(admin))).status, 404);
  assert.equal((await request(app).get('/uploads/documentos/.env').set(auth(admin))).status, 404);
});
