const { resetDatabase, closeDatabase } = require('../helpers/testEnv');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const app = require('../../src/app');
const db = require('../../src/config/db');
const { crearUsuario, auth } = require('../helpers/fixtures');

let admin, usuario;

// PNG de 1×1 píxel y un PDF mínimo: lo que importa es la firma binaria, no el contenido.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');

before(async () => {
  await resetDatabase();
  admin = await crearUsuario({ rol: 'ADMIN' });
  usuario = await crearUsuario();
});
after(closeDatabase);

const base = { titulo: 'Limpieza del canal principal', descripcion_corta: 'Este sábado se limpia el canal desde la bocatoma.', descripcion_larga: 'La minga comienza a las 7:00. Traer pala, machete y botas. Habrá refrigerio para todos los asistentes.', tags: ['minga', 'canal'] };

function publicar(campos = {}, { imagen = PNG, quien = admin } = {}) {
  const c = { ...base, ...campos };
  let r = request(app).post('/api/noticias').set(auth(quien))
    .field('titulo', c.titulo ?? '').field('descripcion_corta', c.descripcion_corta ?? '').field('descripcion_larga', c.descripcion_larga ?? '')
    .field('tags', typeof c.tags === 'string' ? c.tags : JSON.stringify(c.tags));
  if (imagen) r = r.attach('archivo', imagen, 'foto.png');
  return r;
}

function editar(id, campos = {}, { imagen = null, quien = admin } = {}) {
  const c = { ...base, ...campos };
  let r = request(app).put(`/api/noticias/${id}`).set(auth(quien))
    .field('titulo', c.titulo).field('descripcion_corta', c.descripcion_corta).field('descripcion_larga', c.descripcion_larga)
    .field('tags', JSON.stringify(c.tags));
  if (imagen) r = r.attach('archivo', imagen, 'nueva.png');
  return r;
}

test('solo la directiva publica, modifica y elimina; la lectura es pública', async () => {
  assert.equal((await request(app).get('/api/noticias')).status, 200);
  assert.equal((await request(app).get('/api/noticias/etiquetas')).status, 200);
  assert.equal((await publicar({}, { quien: usuario })).status, 403);
  assert.equal((await request(app).post('/api/noticias').send(base)).status, 401);
  assert.equal((await request(app).put('/api/noticias/1').send(base)).status, 401);
  assert.equal((await request(app).delete('/api/noticias/1').set(auth(usuario))).status, 403);
});

test('valida título, descripciones, etiquetas e imagen', async () => {
  const malos = [
    { titulo: 'Hey' }, { titulo: 'x'.repeat(161) }, { descripcion_corta: 'corta' }, { descripcion_corta: 'x'.repeat(301) },
    { descripcion_larga: 'muy corta' }, { tags: [] }, { tags: 'no es json' }, { tags: ['a'] }, { tags: ['ok', '<script>'] },
    { tags: Array.from({ length: 9 }, (_, i) => `etiqueta${i}`) }
  ];
  for (const campos of malos) assert.equal((await publicar(campos)).status, 400, JSON.stringify(campos).slice(0, 80));

  const sinImagen = await publicar({}, { imagen: null });
  assert.equal(sinImagen.status, 400);
  assert.match(sinImagen.body.message, /imagen/i);

  const pdf = await publicar({}, { imagen: PDF });
  assert.equal(pdf.status, 400, 'un PDF no es una imagen');
  assert.match(pdf.body.message, /JPG o PNG/);

  const texto = await publicar({}, { imagen: Buffer.from('esto no es una imagen') });
  assert.equal(texto.status, 400);
  assert.equal((await db.query('SELECT COUNT(*) AS n FROM noticias'))[0][0].n, 0, 'nada se guardó');
});

test('publica una noticia con etiquetas normalizadas, imagen pública y auditoría', async () => {
  const res = await publicar({ tags: ['  Minga ', 'CANAL', 'minga', 'Riego 2026'] });
  assert.equal(res.status, 201, JSON.stringify(res.body));

  const [[noticia]] = await db.query('SELECT titulo, imagen_url, creada_por_cuenta_id FROM noticias WHERE id = ?', [res.body.noticiaId]);
  assert.equal(noticia.titulo, base.titulo);
  assert.equal(noticia.creada_por_cuenta_id, admin.cuentaId);
  assert.match(noticia.imagen_url, /^\/uploads\/documentos\/noticia_[0-9a-f-]{36}\.png$/);

  const [etiquetas] = await db.query('SELECT etiqueta FROM noticia_etiquetas WHERE noticia_id = ? ORDER BY etiqueta', [res.body.noticiaId]);
  assert.deepEqual(etiquetas.map((e) => e.etiqueta), ['canal', 'minga', 'riego 2026']);

  // La imagen se ve sin iniciar sesión, con su tipo correcto.
  const imagen = await request(app).get(noticia.imagen_url);
  assert.equal(imagen.status, 200);
  assert.equal(imagen.headers['content-type'], 'image/png');

  const [auditoria] = await db.query("SELECT accion FROM auditoria WHERE entidad = 'noticias' AND entidad_id = ?", [res.body.noticiaId]);
  assert.deepEqual(auditoria.map((a) => a.accion), ['CREAR']);
});

test('la lista va de la más reciente a la más antigua, sin la descripción larga, y se pagina', async () => {
  await db.query('DELETE FROM noticias');
  const ids = [];
  for (let n = 1; n <= 7; n += 1) {
    const r = await publicar({ titulo: `Noticia número ${n}`, tags: n % 2 ? ['impar', 'general'] : ['par', 'general'] });
    assert.equal(r.status, 201);
    ids.push(r.body.noticiaId);
    await db.query('UPDATE noticias SET publicada_en = ? WHERE id = ?', [`2026-0${n}-15 15:00:00`, r.body.noticiaId]);
  }

  const primera = await request(app).get('/api/noticias?limite=5');
  assert.equal(primera.status, 200);
  assert.equal(primera.body.total, 7);
  assert.deepEqual(primera.body.data.map((n) => n.titulo), ['Noticia número 7', 'Noticia número 6', 'Noticia número 5', 'Noticia número 4', 'Noticia número 3']);
  assert.equal('descripcion_larga' in primera.body.data[0], false, 'la lista no trae el texto largo');
  assert.deepEqual(primera.body.data[0].tags, ['general', 'impar']);

  const segunda = await request(app).get('/api/noticias?limite=5&pagina=2');
  assert.deepEqual(segunda.body.data.map((n) => n.titulo), ['Noticia número 2', 'Noticia número 1']);
  assert.equal((await request(app).get('/api/noticias?limite=51')).status, 400);
});

test('filtra por texto, etiqueta y días de Ecuador', async () => {
  const titulos = async (consulta) => (await request(app).get(`/api/noticias?${consulta}`)).body.data.map((n) => n.titulo);

  assert.deepEqual(await titulos('tag=par'), ['Noticia número 6', 'Noticia número 4', 'Noticia número 2']);
  assert.deepEqual(await titulos('tag=PAR'), ['Noticia número 6', 'Noticia número 4', 'Noticia número 2'], 'la etiqueta no distingue mayúsculas');
  assert.deepEqual(await titulos('q=número 3'), ['Noticia número 3']);
  assert.deepEqual(await titulos('q=impar'), ['Noticia número 7', 'Noticia número 5', 'Noticia número 3', 'Noticia número 1'], 'el texto también busca en las etiquetas');
  assert.deepEqual(await titulos('q=100%'), [], 'los comodines de LIKE se tratan como texto');

  assert.deepEqual(await titulos('desde=2026-03-01&hasta=2026-05-31'), ['Noticia número 5', 'Noticia número 4', 'Noticia número 3']);
  // 15:00 UTC del 15 de mayo es 10:00 en Ecuador: el mismo día.
  assert.deepEqual(await titulos('desde=2026-05-15&hasta=2026-05-15'), ['Noticia número 5']);
  assert.deepEqual(await titulos('tag=par&desde=2026-03-01'), ['Noticia número 6', 'Noticia número 4']);
  assert.equal((await request(app).get('/api/noticias?desde=ayer')).status, 400);

  const etiquetas = (await request(app).get('/api/noticias/etiquetas')).body.data;
  assert.deepEqual(etiquetas[0], { etiqueta: 'general', cantidad: 7 });
  assert.deepEqual(etiquetas.map((e) => e.etiqueta), ['general', 'impar', 'par']);
});

test('el detalle trae la descripción larga y responde 404 si no existe', async () => {
  const [[{ id }]] = await db.query("SELECT id FROM noticias WHERE titulo = 'Noticia número 7'");
  const res = await request(app).get(`/api/noticias/${id}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.data.descripcion_larga, base.descripcion_larga);
  assert.equal((await request(app).get('/api/noticias/999999')).status, 404);
  assert.equal((await request(app).get('/api/noticias/abc')).status, 400);
});

test('modificar conserva la imagen salvo que se adjunte otra, que reemplaza a la anterior', async () => {
  const creada = await publicar({ titulo: 'Para editar' });
  const id = creada.body.noticiaId;
  const [[antes]] = await db.query('SELECT imagen_url FROM noticias WHERE id = ?', [id]);

  const sinImagen = await editar(id, { titulo: 'Título nuevo', tags: ['editada'] });
  assert.equal(sinImagen.status, 200, JSON.stringify(sinImagen.body));
  const [[despues]] = await db.query('SELECT titulo, imagen_url FROM noticias WHERE id = ?', [id]);
  assert.equal(despues.titulo, 'Título nuevo');
  assert.equal(despues.imagen_url, antes.imagen_url);
  const [etiquetas] = await db.query('SELECT etiqueta FROM noticia_etiquetas WHERE noticia_id = ?', [id]);
  assert.deepEqual(etiquetas.map((e) => e.etiqueta), ['editada'], 'las etiquetas se reemplazan');

  const conImagen = await editar(id, {}, { imagen: PNG });
  assert.equal(conImagen.status, 200);
  const [[nueva]] = await db.query('SELECT imagen_url FROM noticias WHERE id = ?', [id]);
  assert.notEqual(nueva.imagen_url, antes.imagen_url);
  assert.equal((await request(app).get(nueva.imagen_url)).status, 200);
  assert.equal((await request(app).get(antes.imagen_url)).status, 404, 'la imagen anterior se borró');

  assert.equal((await editar(id, { titulo: 'No' })).status, 400);
  assert.equal((await editar(id, {}, { imagen: PDF })).status, 400);
  assert.equal((await editar(999999)).status, 404);
  assert.equal((await editar(id, {}, { quien: usuario })).status, 403);

  const [auditoria] = await db.query("SELECT accion FROM auditoria WHERE entidad = 'noticias' AND entidad_id = ? ORDER BY id", [id]);
  assert.deepEqual(auditoria.map((a) => a.accion), ['CREAR', 'MODIFICAR', 'MODIFICAR']);
});

test('eliminar borra la noticia, sus etiquetas y su imagen', async () => {
  const creada = await publicar({ titulo: 'Para eliminar' });
  const id = creada.body.noticiaId;
  const [[{ imagen_url: imagen }]] = await db.query('SELECT imagen_url FROM noticias WHERE id = ?', [id]);

  assert.equal((await request(app).delete(`/api/noticias/${id}`).set(auth(usuario))).status, 403);
  const res = await request(app).delete(`/api/noticias/${id}`).set(auth(admin));
  assert.equal(res.status, 200);

  assert.equal((await request(app).get(`/api/noticias/${id}`)).status, 404);
  assert.equal((await db.query('SELECT 1 FROM noticia_etiquetas WHERE noticia_id = ?', [id]))[0].length, 0);
  assert.equal((await request(app).get(imagen)).status, 404);
  assert.equal((await request(app).delete(`/api/noticias/${id}`).set(auth(admin))).status, 404);

  const [auditoria] = await db.query("SELECT accion FROM auditoria WHERE entidad = 'noticias' AND entidad_id = ? ORDER BY id", [id]);
  assert.deepEqual(auditoria.map((a) => a.accion), ['CREAR', 'ELIMINAR']);
});
