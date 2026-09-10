const db = require('../config/db');
const { registrarAuditoria } = require('../services/auditService');

/**
 * Obtener catálogo de sectores
 */
async function getSectores(req, res, next) {
  try {
    const sql = `
      SELECT s.*, 
             (SELECT COUNT(*) FROM lotes l WHERE l.sector_id = s.id) AS lotesCount
      FROM sectores s 
      WHERE s.activo = TRUE 
      ORDER BY s.nombre ASC
    `;
    const [sectores] = await db.query(sql);
    
    // Asignamos un canal simulado y caudal basado en los lotes si la BD no los tiene nativamente
    const data = sectores.map(s => ({
      ...s,
      canal: s.descripcion || `Canal Matriz ${s.nombre.charAt(0)}`,
      caudal: `${(s.lotesCount * 0.4).toFixed(1)} L/s`
    }));

    return res.json({ status: 'OK', data });
  } catch (error) {
    next(error);
  }
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

    let sql = `SELECT l.*, s.nombre AS sector_nombre,
                      (SELECT GROUP_CONCAT(CONCAT(p.nombres, ' ', p.apellidos, ' (', pl.tipo_relacion, ')') SEPARATOR ', ')
                       FROM persona_lotes pl JOIN personas p ON p.id = pl.persona_id
                       WHERE pl.lote_id = l.id) AS propietarios
               FROM lotes l
               JOIN sectores s ON s.id = l.sector_id
               WHERE l.activo = TRUE`;
    const params = [];

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
 * Crear lote y asociar a comunero
 */
async function createLote(req, res, next) {
  try {
    const { sector_id, codigo, superficie_m2, ancho_m, largo_m, latitud_aproximada, longitud_aproximada, radio_error_m, referencia_ubicacion, observacion, persona_id, tipo_relacion } = req.body;

    if (!sector_id || !codigo) {
      return res.status(400).json({ status: 'ERROR', message: 'Sector y Código del Lote son campos obligatorios.' });
    }

    const [result] = await db.query(
      `INSERT INTO lotes (sector_id, codigo, superficie_m2, ancho_m, largo_m, latitud_aproximada, longitud_aproximada, radio_error_m, referencia_ubicacion, observacion)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [sector_id, codigo.trim(), superficie_m2 || null, ancho_m || null, largo_m || null, latitud_aproximada || null, longitud_aproximada || null, radio_error_m || null, referencia_ubicacion || null, observacion || null]
    );

    const loteId = result.insertId;

    if (persona_id) {
      await db.query(
        `INSERT INTO persona_lotes (persona_id, lote_id, tipo_relacion, fecha_desde)
         VALUES (?, ?, ?, CURDATE())`,
        [persona_id, loteId, tipo_relacion || 'PROPIETARIO']
      );
    }

    await registrarAuditoria({
      cuentaId: req.user ? req.user.cuentaId : null,
      accion: 'CREAR',
      entidad: 'lotes',
      entidadId: loteId,
      ip: req.ip,
      detalle: { codigo, sector_id, latitud_aproximada, longitud_aproximada }
    });

    return res.status(201).json({ status: 'OK', message: 'Lote georreferenciado creado correctamente.', loteId });
  } catch (error) {
    next(error);
  }
}

/**
 * Vincular persona a lote existente
 */
async function linkPersonaLote(req, res, next) {
  try {
    const { loteId } = req.params;
    const { persona_id, tipo_relacion, porcentaje } = req.body;

    if (!persona_id) {
      return res.status(400).json({ status: 'ERROR', message: 'ID de comunero requerido.' });
    }

    await db.query(
      `INSERT INTO persona_lotes (persona_id, lote_id, tipo_relacion, porcentaje, fecha_desde)
       VALUES (?, ?, ?, ?, CURDATE())`,
      [persona_id, loteId, tipo_relacion || 'PROPIETARIO', porcentaje || 100.00]
    );

    return res.json({ status: 'OK', message: 'Comunero vinculado al lote exitosamente.' });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getSectores,
  createSector,
  getLotes,
  createLote,
  linkPersonaLote
};
