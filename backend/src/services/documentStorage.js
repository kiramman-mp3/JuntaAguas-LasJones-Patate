const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const multer = require('multer');
const env = require('../config/env');
const { badRequest } = require('../shared/errors');

const DIRECTORIO = path.resolve(env.UPLOADS_DIR, 'documentos');
const PREFIJO_URL = '/uploads/documentos/';
const TAMANO_MAXIMO = 10 * 1024 * 1024;

// Se identifica el tipo por su firma binaria, no por la extensión ni el MIME que envía el navegador.
const TIPOS = [
  { ext: 'pdf', mime: 'application/pdf', firma: Buffer.from('%PDF-') },
  { ext: 'png', mime: 'image/png', firma: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) },
  { ext: 'jpg', mime: 'image/jpeg', firma: Buffer.from([0xff, 0xd8, 0xff]) }
];
const MIME_POR_EXT = Object.fromEntries(TIPOS.map((t) => [t.ext, t.mime]));

// Nombres generados por el servidor (actuales y heredados): sin separadores de ruta.
const NOMBRE_SEGURO = /^[A-Za-z0-9_-]+\.(pdf|png|jpg|jpeg)$/;

/** Middleware multer: un único archivo en memoria, con límite de tamaño. */
const recibirArchivo = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: TAMANO_MAXIMO, files: 1, fields: 10 }
}).single('archivo');

function detectarTipo(buffer) {
  return TIPOS.find((t) => buffer.length >= t.firma.length && buffer.subarray(0, t.firma.length).equals(t.firma)) || null;
}

/**
 * Valida y guarda un documento subido. El nombre en disco lo genera el servidor.
 * @param {Buffer} buffer contenido del archivo
 * @param {string} prefijo identificador legible (solo letras minúsculas y guion bajo)
 * @returns {{ url: string, mime: string }}
 */
async function guardarDocumento(buffer, prefijo) {
  if (!buffer || !buffer.length) throw badRequest('Debe adjuntar un archivo.');
  const tipo = detectarTipo(buffer);
  if (!tipo) throw badRequest('Formato no permitido. Suba un PDF o una imagen JPG/PNG.');
  if (!/^[a-z_]{1,40}$/.test(prefijo)) throw new Error(`Prefijo de documento inválido: ${prefijo}`);

  await fs.mkdir(DIRECTORIO, { recursive: true });
  const nombre = `${prefijo}_${crypto.randomUUID()}.${tipo.ext}`;
  await fs.writeFile(path.join(DIRECTORIO, nombre), buffer, { flag: 'wx' });
  return { url: `${PREFIJO_URL}${nombre}`, mime: tipo.mime };
}

/** Ruta absoluta de un archivo del directorio de documentos, o null si el nombre no es seguro. */
function rutaSegura(nombre) {
  if (typeof nombre !== 'string' || !NOMBRE_SEGURO.test(nombre)) return null;
  const ruta = path.resolve(DIRECTORIO, nombre);
  return path.dirname(ruta) === DIRECTORIO ? ruta : null;
}

/** Nombre de archivo a partir de una URL '/uploads/documentos/<nombre>'. */
function nombreDesdeUrl(url) {
  return typeof url === 'string' && url.startsWith(PREFIJO_URL) ? url.slice(PREFIJO_URL.length) : null;
}

/** Elimina un documento previo; ignora rutas ajenas al directorio o archivos inexistentes. */
async function eliminarDocumento(url) {
  const ruta = rutaSegura(nombreDesdeUrl(url));
  if (!ruta) return;
  await fs.unlink(ruta).catch((error) => {
    if (error.code !== 'ENOENT') console.error('[Documentos] No se pudo eliminar el archivo anterior:', error.message);
  });
}

function mimeDe(nombre) {
  const ext = path.extname(nombre).slice(1).toLowerCase();
  return MIME_POR_EXT[ext === 'jpeg' ? 'jpg' : ext] || 'application/octet-stream';
}

module.exports = { recibirArchivo, guardarDocumento, eliminarDocumento, rutaSegura, nombreDesdeUrl, mimeDe, PREFIJO_URL, TAMANO_MAXIMO };
