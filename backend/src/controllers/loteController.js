const db = require('../config/db');
const { registrarAuditoria } = require('../services/auditService');
const { personaPermitida } = require('../shared/roles');
const { FORMATO_CODIGO_LOTE, normalizarCodigo, prefijoSector } = require('../utils/loteCodigo');

async function sugerirCodigo(req, res, next) {
  try {
    const sectorId = Number(req.query.sector_id);
    if (!Number.isSafeInteger(sectorId) || sectorId <= 0) {
      return res.status(400).json({ status: 'ERROR', message: 'Seleccione un sector válido para sugerir el código.' });
    }
    const [sectores] = await db.query('SELECT nombre FROM sectores WHERE id = ? AND activo = TRUE', [sectorId]);
    if (!sectores.length) {
      return res.status(404).json({ status: 'ERROR', message: 'El sector seleccionado no existe o está inactivo.' });
    }
    // Incluye lotes inactivos: sus códigos también están sujetos al UNIQUE global.
    const prefijo = prefijoSector(sectores[0].nombre);
    const [codigos] = await db.query('SELECT codigo FROM lotes WHERE codigo LIKE ?', [`${prefijo}-%`]);
    let consecutivo = 0;
    for (const lote of codigos) {
      const codigo = normalizarCodigo(lote.codigo);
      if (FORMATO_CODIGO_LOTE.test(codigo)) consecutivo = Math.max(consecutivo, Number(codigo.slice(4)));
    }
    if (consecutivo >= 99999999) {
      return res.status(409).json({ status: 'ERROR', message: 'Se agotaron los códigos para este prefijo.' });
    }
    const codigo = `${prefijo}-${String(consecutivo + 1).padStart(3, '0')}`;
    return res.json({ status: 'OK', data: { codigo } });
  } catch (error) {
    next(error);
  }
}

/**
 * Obtener catálogo de sectores
 */
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

/**
 * Crear sector
 */
async function createSector(req, res, next) {
  try {
    const { nombre, descripcion } = req.body;
    if (!nombre) {
      return res.status(400).json({ status: 'ERROR', message: 'El nombre del sector es obligatorio.' });
    }

    const [result] = await db.query(`INSERT INTO sectores (nombre, descripcion) VALUES (?, ?)`, [nombre.trim(), descripcion || null]);
    return res.status(201).json({ status: 'OK', message: 'Sector creado exitosamente.', sectorId: result.insertId });
  } catch (error) {
    next(error);
  }
}

/**
 * Listar lotes georreferenciados
 */
async function getLotes(req, res, next) {
  try {
    const { sector_id, busqueda } = req.query;
    const persona_id = personaPermitida(req.user, req.query.persona_id);

    let sql = `SELECT l.id, l.sector_id, l.codigo, l.superficie_m2, l.ancho_m, l.largo_m,
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
               WHERE l.activo = TRUE`;
    const params = [];

    if (persona_id) {
      sql += ` AND EXISTS (SELECT 1 FROM persona_lotes pl WHERE pl.lote_id = l.id AND pl.persona_id = ?)`;
      params.push(persona_id);
    }

    if (sector_id) {
      sql += ` AND l.sector_id = ?`;
      params.push(sector_id);
    }

    if (busqueda) {
      sql += ` AND (l.codigo LIKE ? OR l.referencia_ubicacion LIKE ?)`;
      const term = `%${busqueda.trim()}%`;
      params.push(term, term);
    }

    sql += ` ORDER BY s.nombre ASC, l.codigo ASC`;

    const [lotes] = await db.query(sql, params);
    return res.json({ status: 'OK', data: lotes });
  } catch (error) {
    next(error);
  }
}

/**
 * Crear lote y asociar a comunero (Titular Único)
 */
async function createLote(req, res, next) {
  try {
    const { sector_id, codigo, superficie_m2, ancho_m, largo_m, latitud_aproximada, longitud_aproximada, radio_error_m, referencia_ubicacion, observacion, persona_id, tipo_relacion } = req.body;

    if (!sector_id || !codigo) {
      return res.status(400).json({ status: 'ERROR', message: 'Sector y Código del Lote son campos obligatorios.' });
    }

    const codigoNormalizado = normalizarCodigo(codigo);
    if (!FORMATO_CODIGO_LOTE.test(codigoNormalizado)) {
      return res.status(400).json({ status: 'ERROR', message: 'El código debe tener tres letras y de tres a ocho dígitos separados por un guion. Ejemplo: LJA-001.' });
    }
    const [existentes] = await db.query('SELECT id FROM lotes WHERE codigo = ?', [codigoNormalizado]);
    if (existentes.length) {
      return res.status(409).json({ status: 'ERROR', message: 'Este código de lote ya está registrado. Solicite otra sugerencia o ingrese un código diferente.' });
    }

    const [result] = await db.query(
      `INSERT INTO lotes (sector_id, codigo, superficie_m2, ancho_m, largo_m, latitud_aproximada, longitud_aproximada, radio_error_m, referencia_ubicacion, observacion)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [sector_id, codigoNormalizado, superficie_m2 || null, ancho_m || null, largo_m || null, latitud_aproximada || null, longitud_aproximada || null, radio_error_m || null, referencia_ubicacion || null, observacion || null]
    );

    const loteId = result.insertId;

    if (persona_id) {
      // Garantizar que solo tenga 1 dueño registrado
      await db.query(`DELETE FROM persona_lotes WHERE lote_id = ?`, [loteId]);
      await db.query(
        `INSERT INTO persona_lotes (persona_id, lote_id, tipo_relacion, porcentaje, fecha_desde)
         VALUES (?, ?, ?, 100.00, CURDATE())`,
        [persona_id, loteId, tipo_relacion || 'PROPIETARIO']
      );
    }

    await registrarAuditoria({
      cuentaId: req.user ? req.user.cuentaId : null,
      accion: 'CREAR',
      entidad: 'lotes',
      entidadId: loteId,
      ip: req.ip,
      detalle: { codigo: codigoNormalizado, sector_id, latitud_aproximada, longitud_aproximada }
    });

    return res.status(201).json({ status: 'OK', message: 'Lote georreferenciado creado correctamente.', loteId });
  } catch (error) {
    // La restricción UNIQUE cubre la carrera entre sugerir/comprobar y el INSERT.
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ status: 'ERROR', message: 'Este código de lote acaba de ser registrado. Solicite otra sugerencia.' });
    }
    next(error);
  }
}

/**
 * Vincular persona a lote existente (Legalmente un terreno solo tendrá 1 dueño)
 */
async function linkPersonaLote(req, res, next) {
  try {
    const { loteId } = req.params;
    const { persona_id, tipo_relacion } = req.body;

    if (!persona_id) {
      return res.status(400).json({ status: 'ERROR', message: 'ID de comunero requerido.' });
    }

    // Como legalmente un terreno solo puede tener un dueño, se reemplaza la titularidad previa
    await db.query(`DELETE FROM persona_lotes WHERE lote_id = ?`, [loteId]);
    await db.query(
      `INSERT INTO persona_lotes (persona_id, lote_id, tipo_relacion, porcentaje, fecha_desde)
       VALUES (?, ?, ?, 100.00, CURDATE())`,
      [persona_id, loteId, tipo_relacion || 'PROPIETARIO']
    );

    return res.json({ status: 'OK', message: 'Titularidad asignada correctamente. El lote ahora pertenece al comunero seleccionado.' });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  sugerirCodigo,
  getSectores,
  createSector,
  getLotes,
  createLote,
  linkPersonaLote
};
