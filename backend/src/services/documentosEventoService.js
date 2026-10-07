/**
 * Documentos firmados de un evento: convocatoria, acta general, lista de asistencia u otros,
 * y el acta firmada de cada punto de una asamblea.
 */
const db = require('../config/db');
const { guardarDocumento, eliminarDocumento } = require('./documentStorage');
const { withTransaction } = require('../shared/transaction');
const { notFound } = require('../shared/errors');

/** Nombre original solo para mostrarlo: sin rutas ni caracteres de control. */
function nombreVisible(original, respaldo) {
  const base = String(original || '').split(/[\\/]/u).pop().replace(/[^\p{L}\p{N} ._()-]/gu, '').trim();
  return (base || respaldo).slice(0, 255);
}

/**
 * Guarda el archivo (validado por su contenido en documentStorage) y lo registra.
 * El registro en la base va en una transacción: si falla, se borra el archivo nuevo;
 * si termina bien, se borra el archivo que reemplazó.
 * @returns {{ url: string, nombre: string }}
 */
async function guardarDocumentoFirmado({ eventoId, tipo, puntoId = null, archivo, cuentaId }) {
  const [eventos] = await db.query('SELECT id FROM eventos WHERE id = ?', [eventoId]);
  if (!eventos.length) throw notFound('Evento no encontrado.');
  if (puntoId) {
    const [puntos] = await db.query('SELECT id FROM puntos_asamblea WHERE id = ? AND evento_id = ?', [puntoId, eventoId]);
    if (!puntos.length) throw notFound('El punto del acta no pertenece a este evento.');
  }

  const { url, mime } = await guardarDocumento(archivo.buffer, puntoId ? 'acta_punto' : tipo.toLowerCase());
  const nombre = nombreVisible(archivo.originalname, `${tipo}_firmado`);

  let urlAnterior;
  try {
    urlAnterior = await withTransaction(async (conexion) => {
      if (puntoId) {
        const [[punto]] = await conexion.query('SELECT acta_firmada_url FROM puntos_asamblea WHERE id = ? FOR UPDATE', [puntoId]);
        await conexion.query(
          `UPDATE puntos_asamblea
           SET acta_firmada_url = ?, acta_firmada_nombre = ?, estado_acta = 'FIRMADA', fecha_acta = UTC_TIMESTAMP()
           WHERE id = ?`,
          [url, nombre, puntoId]
        );
        return punto?.acta_firmada_url ?? null;
      }
      const [existente] = await conexion.query(
        'SELECT ruta_archivo_firmado FROM documentos_evento WHERE evento_id = ? AND tipo = ? FOR UPDATE', [eventoId, tipo]
      );
      await conexion.query(
        `INSERT INTO documentos_evento
           (evento_id, tipo, estado, nombre_archivo, ruta_archivo_firmado, nombre_archivo_firmado, mime_type, fecha_subida_firmado, subido_por_cuenta_id)
         VALUES (?, ?, 'FIRMADO', ?, ?, ?, ?, UTC_TIMESTAMP(), ?)
         ON DUPLICATE KEY UPDATE estado = 'FIRMADO', nombre_archivo = VALUES(nombre_archivo),
           ruta_archivo_firmado = VALUES(ruta_archivo_firmado), nombre_archivo_firmado = VALUES(nombre_archivo_firmado),
           mime_type = VALUES(mime_type), fecha_subida_firmado = VALUES(fecha_subida_firmado),
           subido_por_cuenta_id = VALUES(subido_por_cuenta_id)`,
        [eventoId, tipo, nombre, url, nombre, mime, cuentaId]
      );
      return existente[0]?.ruta_archivo_firmado ?? null;
    });
  } catch (error) {
    await eliminarDocumento(url);
    throw error;
  }
  if (urlAnterior && urlAnterior !== url) await eliminarDocumento(urlAnterior);
  return { url, nombre };
}

/** Documentos registrados de un evento (sin el contenido). */
async function listarDocumentos(eventoId) {
  const [documentos] = await db.query(
    `SELECT id, tipo, estado, nombre_archivo, ruta_archivo_firmado, mime_type, fecha_subida_firmado, updated_at
     FROM documentos_evento WHERE evento_id = ? ORDER BY tipo`,
    [eventoId]
  );
  return documentos;
}

module.exports = { nombreVisible, guardarDocumentoFirmado, listarDocumentos };
