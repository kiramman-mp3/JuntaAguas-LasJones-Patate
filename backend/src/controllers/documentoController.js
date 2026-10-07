const db = require('../config/db');
const { rutaSegura, mimeDe, PREFIJO_URL } = require('../services/documentStorage');
const { notFound, unauthorized, forbidden } = require('../shared/errors');
const { esAdmin } = require('../shared/roles');

const ACCESO = Object.freeze({ PUBLICO: 'PUBLICO', COMUNEROS: 'COMUNEROS', ADMIN: 'ADMIN' });

/**
 * Determina quién puede ver un documento según dónde está registrado:
 * - convocatoria de un evento ya anunciado: pública,
 * - actas y resoluciones: cualquier persona con sesión,
 * - listas de asistencia (contienen el padrón) u otros: solo administración.
 * Un archivo que no está registrado en la base no se sirve.
 */
async function nivelDeAcceso(url) {
  const [documentos] = await db.query(
    `SELECT d.tipo, e.estado FROM documentos_evento d JOIN eventos e ON e.id = d.evento_id
     WHERE d.ruta_archivo_firmado = ? OR d.ruta_archivo_generado = ?`,
    [url, url]
  );
  const [actas] = await db.query('SELECT id FROM puntos_asamblea WHERE acta_firmada_url = ? LIMIT 1', [url]);

  const niveles = documentos.map((d) => {
    if (d.tipo === 'CONVOCATORIA' && d.estado !== 'BORRADOR') return ACCESO.PUBLICO;
    if (d.tipo === 'ACTA' || d.tipo === 'RESOLUCION') return ACCESO.COMUNEROS;
    return ACCESO.ADMIN;
  });
  if (actas.length) niveles.push(ACCESO.COMUNEROS);
  if (!niveles.length) return null;
  if (niveles.includes(ACCESO.PUBLICO)) return ACCESO.PUBLICO;
  if (niveles.includes(ACCESO.COMUNEROS)) return ACCESO.COMUNEROS;
  return ACCESO.ADMIN;
}

async function servirDocumento(req, res) {
  const nombre = req.params.archivo;
  const ruta = rutaSegura(nombre);
  if (!ruta) throw notFound('Documento no encontrado.');

  const nivel = await nivelDeAcceso(`${PREFIJO_URL}${nombre}`);
  if (!nivel) throw notFound('Documento no encontrado.');
  if (nivel !== ACCESO.PUBLICO && !req.user) throw unauthorized('Inicie sesión para ver este documento.');
  if (nivel === ACCESO.ADMIN && !esAdmin(req.user)) throw forbidden('Este documento es de uso administrativo.');

  res.set({
    'Content-Type': mimeDe(nombre),
    'Content-Disposition': `inline; filename="${nombre}"`,
    'Cache-Control': nivel === ACCESO.PUBLICO ? 'public, max-age=300' : 'private, no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  return res.sendFile(ruta, (error) => {
    if (error && !res.headersSent) res.status(404).json({ status: 'ERROR', message: 'Documento no encontrado.' });
  });
}

module.exports = { servirDocumento };
