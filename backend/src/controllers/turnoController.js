const db = require('../config/db');
const { registrarAuditoria } = require('../services/auditService');

/**
 * Obtener turnos de agua de riego
 */
async function getTurnos(req, res, next) {
  try {
    const { dia_semana, persona_id, lote_id, sector_id } = req.query;

    let sql = `SELECT t.*,
                      CONCAT(p.nombres, ' ', p.apellidos) AS comunero_nombre, p.cedula,
                      l.codigo AS lote_codigo, s.nombre AS sector_nombre
               FROM turnos_riego t
               JOIN personas p ON p.id = t.persona_id
               LEFT JOIN lotes l ON l.id = t.lote_id
               LEFT JOIN sectores s ON s.id = l.sector_id
               WHERE t.estado = 'ACTIVO'`;
    const params = [];

    if (dia_semana) {
      sql += ` AND t.dia_semana = ?`;
      params.push(dia_semana);
    }
    if (persona_id) {
      sql += ` AND t.persona_id = ?`;
      params.push(persona_id);
    }
    if (lote_id) {
      sql += ` AND t.lote_id = ?`;
      params.push(lote_id);
    }
    if (sector_id) {
      sql += ` AND l.sector_id = ?`;
      params.push(sector_id);
    }

    sql += ` ORDER BY t.dia_semana ASC, t.hora_inicio ASC`;

    const [turnos] = await db.query(sql, params);
    return res.json({ status: 'OK', data: turnos });
  } catch (error) {
    next(error);
  }
}

/**
 * Asignar nuevo turno de agua con validación de horario no solapado
 */
async function createTurno(req, res, next) {
  try {
    const { persona_id, lote_id, tipo, dia_semana, hora_inicio, hora_fin, vigencia_desde, observacion } = req.body;

    if (!persona_id || !dia_semana || !hora_inicio || !hora_fin) {
      return res.status(400).json({ status: 'ERROR', message: 'Comunero, día de la semana y horas (inicio/fin) son requeridos.' });
    }

    if (parseInt(dia_semana) < 1 || parseInt(dia_semana) > 7) {
      return res.status(400).json({ status: 'ERROR', message: 'El día de la semana debe ser un valor entre 1 (Lunes) y 7 (Domingo).' });
    }

    if (hora_inicio >= hora_fin) {
      return res.status(400).json({ status: 'ERROR', message: 'La hora de inicio debe ser menor a la hora de finalización.' });
    }

    // Validar solapamientos de horario incompatibles en el mismo lote
    if (lote_id) {
      const [solapados] = await db.query(
        `SELECT id FROM turnos_riego
         WHERE lote_id = ? AND dia_semana = ? AND estado = 'ACTIVO'
           AND (? < hora_fin AND ? > hora_inicio)`,
        [lote_id, dia_semana, hora_inicio, hora_fin]
      );

      if (solapados.length > 0) {
        return res.status(400).json({
          status: 'ERROR',
          message: 'Existe un conflicto de horarios. El lote ya tiene asignado un turno de agua que se solapa en el mismo día y horario.'
        });
      }
    }

    const [result] = await db.query(
      `INSERT INTO turnos_riego (persona_id, lote_id, tipo, dia_semana, hora_inicio, hora_fin, vigencia_desde, observacion)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [persona_id, lote_id || null, tipo || 'REGULAR', dia_semana, hora_inicio, hora_fin, vigencia_desde || null, observacion || null]
    );

    const turnoId = result.insertId;

    await registrarAuditoria({
      cuentaId: req.user ? req.user.cuentaId : null,
      accion: 'CREAR',
      entidad: 'turnos_riego',
      entidadId: turnoId,
      ip: req.ip,
      detalle: { persona_id, lote_id, dia_semana, hora_inicio, hora_fin }
    });

    return res.status(201).json({ status: 'OK', message: 'Turno de agua asignado correctamente.', turnoId });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getTurnos,
  createTurno
};
