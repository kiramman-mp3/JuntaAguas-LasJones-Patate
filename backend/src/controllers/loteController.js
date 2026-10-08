const db = require('../config/db');
const { registrarAuditoria } = require('../services/auditService');
const { personaPermitida } = require('../shared/roles');
const { withTransaction } = require('../shared/transaction');
const { hoy } = require('../shared/dates');
const { badRequest, notFound, conflict } = require('../shared/errors');
const { FORMATO_CODIGO_LOTE, normalizarCodigo, prefijoSector } = require('../utils/loteCodigo');
const s = require('../shared/schemas');
const { z } = s;

/** Número opcional: '' y null se guardan como null. */
const numeroOpcional = (esquema) => z.preprocess((v) => (v === '' || v === null ? undefined : v), esquema.optional()).transform((v) => v ?? null);
const relacion = z.enum(['PROPIETARIO', 'REPRESENTANTE']).default('PROPIETARIO');

/** Titularidad única: un lote pertenece al 100 % a un solo comunero. Se rechaza cualquier otro valor en lugar de ignorarlo. */
const PORCENTAJE_TITULARIDAD = 100;
const porcentajeTitularidad = z.coerce
  .number({ error: 'El porcentaje de propiedad debe ser 100.' })
  .refine((v) => v === PORCENTAJE_TITULARIDAD, 'Un lote pertenece al 100 % a un solo comunero; no se admite propiedad compartida.')
  .optional();

const sugerirQuery = z.object({ sector_id: z.coerce.number({ error: 'Seleccione un sector válido para sugerir el código.' }).int().positive('Seleccione un sector válido para sugerir el código.') });

const sectorSchema = z.object({
  nombre: z.string({ error: 'El nombre del sector es obligatorio.' }).trim().min(2, 'El nombre del sector es obligatorio.').max(100),
  descripcion: s.textoOpcional(255)
});

const lotesQuery = z.object({
  sector_id: s.id.optional(),
  persona_id: s.id.optional(),
  busqueda: z.string().trim().max(100).optional(),
  // Opcional: sin page se devuelve la lista completa (la usan los selectores de lote de los formularios).
  page: z.coerce.number().int().min(1).optional(),
  limit: s.paginacion.shape.limit
});

const loteSchema = z.object({
  sector_id: s.id,
  codigo: z.string({ error: 'El código del lote es obligatorio.' }).transform(normalizarCodigo)
    .refine((c) => FORMATO_CODIGO_LOTE.test(c), 'El código debe tener tres letras y de tres a ocho dígitos separados por un guion. Ejemplo: LJA-001.'),
  superficie_m2: numeroOpcional(z.coerce.number().positive('La superficie debe ser mayor a cero.').max(10_000_000)),
  ancho_m: numeroOpcional(z.coerce.number().positive().max(100_000)),
  largo_m: numeroOpcional(z.coerce.number().positive().max(100_000)),
  latitud_aproximada: numeroOpcional(z.coerce.number().min(-90).max(90)),
  longitud_aproximada: numeroOpcional(z.coerce.number().min(-180).max(180)),
  radio_error_m: numeroOpcional(z.coerce.number().min(0).max(10_000)),
  referencia_ubicacion: s.textoOpcional(255),
  observacion: s.textoOpcional(255),
  persona_id: s.id.optional(),
  tipo_relacion: relacion,
  porcentaje: porcentajeTitularidad
});

const vincularSchema = z.object({
  persona_id: s.id,
  tipo_relacion: relacion,
  porcentaje: porcentajeTitularidad,
  observacion: s.textoOpcional(255)
});
const loteParam = z.object({ loteId: s.id });

async function verificarPersonaActiva(conexion, personaId) {
  const [filas] = await conexion.query("SELECT id, CONCAT(nombres, ' ', apellidos) AS nombre FROM personas WHERE id = ? AND estado = 'ACTIVO'", [personaId]);
  if (!filas.length) throw notFound('El comunero no existe o está inactivo.');
  return filas[0];
}

/** Próximo código libre del prefijo del sector (cuenta también lotes inactivos y de otros sectores). */
async function sugerirCodigo(req, res) {
  const { sector_id: sectorId } = sugerirQuery.parse(req.query);
  const [sectores] = await db.query('SELECT nombre FROM sectores WHERE id = ? AND activo = TRUE', [sectorId]);
  if (!sectores.length) throw notFound('El sector seleccionado no existe o está inactivo.');
  // Incluye lotes inactivos: sus códigos también están sujetos al UNIQUE global.
  const prefijo = prefijoSector(sectores[0].nombre);
  const [codigos] = await db.query('SELECT codigo FROM lotes WHERE codigo LIKE ?', [`${prefijo}-%`]);
  let consecutivo = 0;
  for (const lote of codigos) {
    const codigo = normalizarCodigo(lote.codigo);
    if (FORMATO_CODIGO_LOTE.test(codigo)) consecutivo = Math.max(consecutivo, Number(codigo.slice(4)));
  }
  if (consecutivo >= 99999999) throw conflict('Se agotaron los códigos para este prefijo.');
  return res.json({ status: 'OK', data: { codigo: `${prefijo}-${String(consecutivo + 1).padStart(3, '0')}` } });
}

/** Catálogo de sectores con el número de lotes activos y su superficie. */
async function getSectores(req, res) {
  const [sectores] = await db.query(
    `SELECT s.id, s.nombre, s.descripcion,
            COUNT(l.id) AS lotesCount,
            ROUND(COALESCE(SUM(l.superficie_m2), 0) / 10000, 2) AS superficieHa
     FROM sectores s
     LEFT JOIN lotes l ON l.sector_id = s.id AND l.activo = TRUE
     WHERE s.activo = TRUE
     GROUP BY s.id
     ORDER BY s.nombre ASC`
  );
  return res.json({ status: 'OK', data: sectores.map((x) => ({ ...x, lotesCount: Number(x.lotesCount), superficieHa: Number(x.superficieHa) })) });
}

async function createSector(req, res) {
  const { nombre, descripcion } = sectorSchema.parse(req.body);
  let sectorId;
  try {
    const [r] = await db.query('INSERT INTO sectores (nombre, descripcion) VALUES (?, ?)', [nombre, descripcion]);
    sectorId = r.insertId;
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') throw conflict(`Ya existe el sector ${nombre}.`);
    throw error;
  }
  await registrarAuditoria({ cuentaId: req.user.cuentaId, accion: 'CREAR', entidad: 'sectores', entidadId: sectorId, ip: req.ip, detalle: { nombre } });
  return res.status(201).json({ status: 'OK', message: 'Sector creado exitosamente.', sectorId });
}

/** Lotes activos con su titular. Un comunero solo recibe los suyos. */
async function getLotes(req, res) {
  const filtros = lotesQuery.parse(req.query);
  const personaId = personaPermitida(req.user, filtros.persona_id);
  const condiciones = ['l.activo = TRUE'];
  const params = [];
  if (personaId) {
    condiciones.push('EXISTS (SELECT 1 FROM persona_lotes x WHERE x.lote_id = l.id AND x.persona_id = ?)');
    params.push(personaId);
  }
  if (filtros.sector_id) { condiciones.push('l.sector_id = ?'); params.push(filtros.sector_id); }
  if (filtros.busqueda) {
    condiciones.push('(l.codigo LIKE ? OR l.referencia_ubicacion LIKE ?)');
    params.push(`%${filtros.busqueda}%`, `%${filtros.busqueda}%`);
  }

  const where = condiciones.join(' AND ');
  const paginado = filtros.page !== undefined;
  const [lotes] = await db.query(
    `SELECT l.id, l.sector_id, l.codigo, l.superficie_m2, l.ancho_m, l.largo_m,
            l.latitud_aproximada, l.longitud_aproximada, l.radio_error_m,
            l.referencia_ubicacion, l.observacion, l.activo, l.created_at,
            s.nombre AS sector_nombre,
            pl.tipo_relacion, pl.porcentaje,
            p.id AS propietario_id, p.cedula AS propietario_cedula,
            CONCAT(p.nombres, ' ', p.apellidos) AS propietario_nombre,
            CASE WHEN p.id IS NOT NULL THEN CONCAT(p.nombres, ' ', p.apellidos, ' (C.I. ', p.cedula, ')') ELSE 'Sin propietario asignado' END AS propietario,
            CONCAT(p.nombres, ' ', p.apellidos) AS propietarios
     FROM lotes l
     JOIN sectores s ON s.id = l.sector_id
     LEFT JOIN persona_lotes pl ON pl.lote_id = l.id
     LEFT JOIN personas p ON p.id = pl.persona_id
     WHERE ${where}
     ORDER BY s.nombre ASC, l.codigo ASC${paginado ? ' LIMIT ? OFFSET ?' : ''}`,
    paginado ? [...params, filtros.limit, (filtros.page - 1) * filtros.limit] : params
  );
  if (!paginado) return res.json({ status: 'OK', data: lotes });

  const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM lotes l WHERE ${where}`, params);
  return res.json({ status: 'OK', data: lotes, pagination: { total, page: filtros.page, limit: filtros.limit } });
}

/** Crear un lote y, si se indica, asignarle su titular en la misma transacción. */
async function createLote(req, res) {
  const datos = loteSchema.parse(req.body);
  let loteId;
  try {
    loteId = await withTransaction(async (conexion) => {
      const [sectores] = await conexion.query('SELECT id FROM sectores WHERE id = ? AND activo = TRUE', [datos.sector_id]);
      if (!sectores.length) throw notFound('El sector seleccionado no existe o está inactivo.');
      const [existentes] = await conexion.query('SELECT id FROM lotes WHERE codigo = ?', [datos.codigo]);
      if (existentes.length) throw conflict('Este código de lote ya está registrado. Solicite otra sugerencia o ingrese un código diferente.');
      if (datos.persona_id) await verificarPersonaActiva(conexion, datos.persona_id);

      const [r] = await conexion.query(
        `INSERT INTO lotes (sector_id, codigo, superficie_m2, ancho_m, largo_m, latitud_aproximada, longitud_aproximada, radio_error_m, referencia_ubicacion, observacion)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [datos.sector_id, datos.codigo, datos.superficie_m2, datos.ancho_m, datos.largo_m, datos.latitud_aproximada,
          datos.longitud_aproximada, datos.radio_error_m, datos.referencia_ubicacion, datos.observacion]
      );
      if (datos.persona_id) {
        await conexion.query(
          `INSERT INTO persona_lotes (persona_id, lote_id, tipo_relacion, porcentaje, fecha_desde) VALUES (?, ?, ?, ?, ?)`,
          [datos.persona_id, r.insertId, datos.tipo_relacion, PORCENTAJE_TITULARIDAD, hoy()]
        );
      }
      return r.insertId;
    });
  } catch (error) {
    // La restricción UNIQUE cubre la carrera entre sugerir/comprobar y el INSERT.
    if (error.code === 'ER_DUP_ENTRY') throw conflict('Este código de lote acaba de ser registrado. Solicite otra sugerencia.');
    throw error;
  }

  await registrarAuditoria({
    cuentaId: req.user.cuentaId, accion: 'CREAR', entidad: 'lotes', entidadId: loteId, ip: req.ip,
    detalle: { codigo: datos.codigo, sector_id: datos.sector_id, persona_id: datos.persona_id ?? null, latitud: datos.latitud_aproximada, longitud: datos.longitud_aproximada }
  });
  return res.status(201).json({ status: 'OK', message: 'Lote georreferenciado creado correctamente.', loteId });
}

/**
 * Asignar o transferir la titularidad de un lote (un lote tiene un solo titular).
 * La transferencia queda en la auditoría con el titular anterior y la fecha desde la que tenía el lote.
 */
async function linkPersonaLote(req, res) {
  const { loteId } = loteParam.parse(req.params);
  const datos = vincularSchema.parse(req.body);

  const resultado = await withTransaction(async (conexion) => {
    const [lotes] = await conexion.query('SELECT id, codigo, activo FROM lotes WHERE id = ? FOR UPDATE', [loteId]);
    if (!lotes.length || !lotes[0].activo) throw notFound('El lote no existe o está inactivo.');
    const nuevo = await verificarPersonaActiva(conexion, datos.persona_id);
    const [previos] = await conexion.query('SELECT persona_id, tipo_relacion, fecha_desde FROM persona_lotes WHERE lote_id = ? FOR UPDATE', [loteId]);
    const anterior = previos[0] ?? null;
    if (anterior && Number(anterior.persona_id) === datos.persona_id && anterior.tipo_relacion === datos.tipo_relacion) {
      throw badRequest('El lote ya pertenece a este comunero.');
    }

    await conexion.query('DELETE FROM persona_lotes WHERE lote_id = ?', [loteId]);
    await conexion.query(
      `INSERT INTO persona_lotes (persona_id, lote_id, tipo_relacion, porcentaje, fecha_desde, observacion) VALUES (?, ?, ?, ?, ?, ?)`,
      [datos.persona_id, loteId, datos.tipo_relacion, PORCENTAJE_TITULARIDAD, hoy(), datos.observacion]
    );
    // Los turnos activos del lote siguen al nuevo titular.
    const [turnos] = await conexion.query(
      "UPDATE turnos_riego SET persona_id = ? WHERE lote_id = ? AND estado = 'ACTIVO' AND persona_id <> ?",
      [datos.persona_id, loteId, datos.persona_id]
    );
    return { lote: lotes[0], nuevo, anterior, turnosReasignados: turnos.affectedRows };
  });

  await registrarAuditoria({
    cuentaId: req.user.cuentaId,
    accion: resultado.anterior ? 'TRANSFERIR' : 'CREAR',
    entidad: 'persona_lotes', entidadId: loteId, ip: req.ip,
    detalle: {
      lote: resultado.lote.codigo,
      anterior: resultado.anterior && { persona_id: resultado.anterior.persona_id, tipo_relacion: resultado.anterior.tipo_relacion, desde: resultado.anterior.fecha_desde },
      nuevo: { persona_id: datos.persona_id, tipo_relacion: datos.tipo_relacion },
      turnosReasignados: resultado.turnosReasignados
    }
  });
  const message = resultado.anterior
    ? `Titularidad transferida a ${resultado.nuevo.nombre}.${resultado.turnosReasignados ? ` ${resultado.turnosReasignados} turno(s) de riego pasaron al nuevo titular.` : ''}`
    : 'Titularidad asignada correctamente. El lote ahora pertenece al comunero seleccionado.';
  return res.json({ status: 'OK', message, turnosReasignados: resultado.turnosReasignados });
}

module.exports = { sugerirCodigo, getSectores, createSector, getLotes, createLote, linkPersonaLote };
