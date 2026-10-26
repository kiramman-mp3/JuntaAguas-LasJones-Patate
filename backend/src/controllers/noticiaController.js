const db = require('../config/db');
const { registrarAuditoria } = require('../services/auditService');
const { guardarDocumento, eliminarDocumento } = require('../services/documentStorage');
const { withTransaction } = require('../shared/transaction');
const { inicioDelDiaUtc, finDelDiaUtc } = require('../shared/dates');
const { badRequest, notFound } = require('../shared/errors');
const s = require('../shared/schemas');
const { z } = s;

const MAX_ETIQUETAS = 8;
const ETIQUETA_VALIDA = /^[\p{L}\p{N}][\p{L}\p{N} _-]*$/u;

/**
 * Las etiquetas llegan como arreglo (JSON) o como texto JSON desde un formulario multipart.
 * Se guardan en minúsculas, sin espacios sobrantes ni repetidas.
 */
const etiquetas = z.preprocess(
  (v) => {
    if (typeof v !== 'string') return v;
    try { return JSON.parse(v); } catch { return v; }
  },
  z.array(
    z.string().trim().toLowerCase()
      .min(2, 'Cada etiqueta debe tener al menos 2 caracteres.')
      .max(30, 'Cada etiqueta admite hasta 30 caracteres.')
      .regex(ETIQUETA_VALIDA, 'Las etiquetas solo admiten letras, números, espacios, guion y guion bajo.'),
    { error: 'Indique al menos una etiqueta.' }
  )
    .min(1, 'Indique al menos una etiqueta.')
    .max(MAX_ETIQUETAS, `Use como máximo ${MAX_ETIQUETAS} etiquetas.`)
).transform((lista) => [...new Set(lista)]);

const noticiaSchema = z.object({
  titulo: z.string({ error: 'El título es obligatorio.' }).trim().min(5, 'El título debe tener al menos 5 caracteres.').max(160, 'El título admite hasta 160 caracteres.'),
  descripcion_corta: z.string({ error: 'La descripción corta es obligatoria.' }).trim().min(10, 'La descripción corta debe tener al menos 10 caracteres.').max(300, 'La descripción corta admite hasta 300 caracteres.'),
  descripcion_larga: z.string({ error: 'La descripción larga es obligatoria.' }).trim().min(20, 'La descripción larga debe tener al menos 20 caracteres.').max(10000, 'La descripción larga admite hasta 10000 caracteres.'),
  tags: etiquetas
});

const listarSchema = z.object({
  q: z.string().trim().max(100).optional(),
  tag: z.string().trim().toLowerCase().max(30).optional(),
  desde: s.fechaOpcional,
  hasta: s.fechaOpcional,
  pagina: z.coerce.number().int().min(1).default(1),
  limite: z.coerce.number().int().min(1).max(50).default(10)
});

/** Une cada noticia con su arreglo de etiquetas (una sola consulta para toda la página). */
async function conEtiquetas(conexion, filas) {
  if (!filas.length) return filas;
  const [rel] = await conexion.query(
    'SELECT noticia_id, etiqueta FROM noticia_etiquetas WHERE noticia_id IN (?) ORDER BY etiqueta',
    [filas.map((f) => f.id)]
  );
  const porNoticia = new Map();
  for (const { noticia_id, etiqueta } of rel) {
    if (!porNoticia.has(noticia_id)) porNoticia.set(noticia_id, []);
    porNoticia.get(noticia_id).push(etiqueta);
  }
  return filas.map((f) => ({ ...f, tags: porNoticia.get(f.id) ?? [] }));
}

const COLUMNAS_LISTA = 'n.id, n.titulo, n.descripcion_corta, n.imagen_url, n.publicada_en';

/** Noticias más recientes primero, con filtros por texto, etiqueta y días de Ecuador. Público. */
async function listar(req, res) {
  const { q, tag, desde, hasta, pagina, limite } = listarSchema.parse(req.query);
  const condiciones = [];
  const params = [];
  if (q) {
    const patron = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
    condiciones.push('(n.titulo LIKE ? OR n.descripcion_corta LIKE ? OR EXISTS (SELECT 1 FROM noticia_etiquetas e WHERE e.noticia_id = n.id AND e.etiqueta LIKE ?))');
    params.push(patron, patron, patron);
  }
  if (tag) { condiciones.push('EXISTS (SELECT 1 FROM noticia_etiquetas e WHERE e.noticia_id = n.id AND e.etiqueta = ?)'); params.push(tag); }
  // publicada_en se guarda en UTC; los filtros son días de Ecuador.
  if (desde) { condiciones.push('n.publicada_en >= ?'); params.push(inicioDelDiaUtc(desde)); }
  if (hasta) { condiciones.push('n.publicada_en < ?'); params.push(finDelDiaUtc(hasta)); }
  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

  const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM noticias n ${where}`, params);
  const [filas] = await db.query(
    `SELECT ${COLUMNAS_LISTA} FROM noticias n ${where} ORDER BY n.publicada_en DESC, n.id DESC LIMIT ? OFFSET ?`,
    [...params, limite, (pagina - 1) * limite]
  );
  return res.json({ status: 'OK', data: await conEtiquetas(db, filas), total, pagina, limite });
}

/** Etiquetas en uso con la cantidad de noticias de cada una (para el filtro). Público. */
async function listarEtiquetas(req, res) {
  const [filas] = await db.query(
    'SELECT etiqueta, COUNT(*) AS cantidad FROM noticia_etiquetas GROUP BY etiqueta ORDER BY cantidad DESC, etiqueta ASC'
  );
  return res.json({ status: 'OK', data: filas });
}

/** Noticia completa con su descripción larga. Público. */
async function obtener(req, res) {
  const { id } = s.idParam.parse(req.params);
  const [filas] = await db.query(`SELECT ${COLUMNAS_LISTA}, n.descripcion_larga FROM noticias n WHERE n.id = ?`, [id]);
  if (!filas.length) throw notFound('Noticia no encontrada.');
  const [noticia] = await conEtiquetas(db, filas);
  return res.json({ status: 'OK', data: noticia });
}

async function guardarEtiquetas(conexion, noticiaId, lista) {
  await conexion.query('DELETE FROM noticia_etiquetas WHERE noticia_id = ?', [noticiaId]);
  await conexion.query('INSERT INTO noticia_etiquetas (noticia_id, etiqueta) VALUES ?', [lista.map((e) => [noticiaId, e])]);
}

/** Crea una noticia (multipart: campos + imagen en "archivo"). La imagen es obligatoria. */
async function crear(req, res) {
  const datos = noticiaSchema.parse(req.body);
  if (!req.file) throw badRequest('La imagen de la noticia es obligatoria.');
  const imagen = await guardarDocumento(req.file.buffer, 'noticia', { soloImagen: true });

  let id;
  try {
    id = await withTransaction(async (conexion) => {
      const [r] = await conexion.query(
        `INSERT INTO noticias (titulo, descripcion_corta, descripcion_larga, imagen_url, creada_por_cuenta_id) VALUES (?, ?, ?, ?, ?)`,
        [datos.titulo, datos.descripcion_corta, datos.descripcion_larga, imagen.url, req.user.cuentaId]
      );
      await guardarEtiquetas(conexion, r.insertId, datos.tags);
      await registrarAuditoria({
        conexion, cuentaId: req.user.cuentaId, accion: 'CREAR', entidad: 'noticias', entidadId: r.insertId, ip: req.ip,
        detalle: { titulo: datos.titulo, tags: datos.tags }
      });
      return r.insertId;
    });
  } catch (error) {
    await eliminarDocumento(imagen.url);
    throw error;
  }
  return res.status(201).json({ status: 'OK', message: 'Noticia publicada.', noticiaId: id });
}

/** Modifica una noticia; la imagen solo se reemplaza si se adjunta una nueva. */
async function actualizar(req, res) {
  const { id } = s.idParam.parse(req.params);
  const datos = noticiaSchema.parse(req.body);
  const nueva = req.file ? await guardarDocumento(req.file.buffer, 'noticia', { soloImagen: true }) : null;

  let anterior;
  try {
    anterior = await withTransaction(async (conexion) => {
      const [[actual]] = await conexion.query('SELECT imagen_url FROM noticias WHERE id = ? FOR UPDATE', [id]);
      if (!actual) throw notFound('Noticia no encontrada.');
      await conexion.query(
        'UPDATE noticias SET titulo = ?, descripcion_corta = ?, descripcion_larga = ?, imagen_url = ? WHERE id = ?',
        [datos.titulo, datos.descripcion_corta, datos.descripcion_larga, nueva?.url ?? actual.imagen_url, id]
      );
      await guardarEtiquetas(conexion, id, datos.tags);
      await registrarAuditoria({
        conexion, cuentaId: req.user.cuentaId, accion: 'MODIFICAR', entidad: 'noticias', entidadId: id, ip: req.ip,
        detalle: { titulo: datos.titulo, tags: datos.tags, imagenReemplazada: Boolean(nueva) }
      });
      return actual.imagen_url;
    });
  } catch (error) {
    if (nueva) await eliminarDocumento(nueva.url);
    throw error;
  }
  if (nueva) await eliminarDocumento(anterior);
  return res.json({ status: 'OK', message: 'Noticia actualizada.' });
}

/** Elimina la noticia, sus etiquetas y su imagen. */
async function eliminar(req, res) {
  const { id } = s.idParam.parse(req.params);
  const imagen = await withTransaction(async (conexion) => {
    const [[actual]] = await conexion.query('SELECT titulo, imagen_url FROM noticias WHERE id = ? FOR UPDATE', [id]);
    if (!actual) throw notFound('Noticia no encontrada.');
    await conexion.query('DELETE FROM noticias WHERE id = ?', [id]);
    await registrarAuditoria({
      conexion, cuentaId: req.user.cuentaId, accion: 'ELIMINAR', entidad: 'noticias', entidadId: id, ip: req.ip,
      detalle: { titulo: actual.titulo }
    });
    return actual.imagen_url;
  });
  await eliminarDocumento(imagen);
  return res.json({ status: 'OK', message: 'Noticia eliminada.' });
}

module.exports = { listar, listarEtiquetas, obtener, crear, actualizar, eliminar };
