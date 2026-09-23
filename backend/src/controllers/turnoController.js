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
 * y generación automática de pago/cobro a la cuenta si es un Turno Adicional
 */
async function createTurno(req, res, next) {
  try {
    const { persona_id, lote_id, tipo, dia_semana, hora_inicio, hora_fin, vigencia_desde, observacion, costo } = req.body;

    if (!persona_id) {
      return res.status(400).json({ status: 'ERROR', message: 'Debe seleccionar un comunero.' });
    }

    if (!lote_id) {
      return res.status(400).json({ status: 'ERROR', message: 'Debe seleccionar un lote para asignar el turno.' });
    }

    if (!dia_semana || parseInt(dia_semana) < 1 || parseInt(dia_semana) > 7) {
      return res.status(400).json({ status: 'ERROR', message: 'El día de la semana debe ser un valor válido entre 1 (Lunes) y 7 (Domingo).' });
    }

    if (!hora_inicio || !hora_fin) {
      return res.status(400).json({ status: 'ERROR', message: 'Las horas de inicio y fin son obligatorias.' });
    }

    if (hora_inicio >= hora_fin) {
      return res.status(400).json({ status: 'ERROR', message: 'La hora de inicio debe ser menor a la hora de finalización.' });
    }

    // Validar solapamientos de horario incompatibles en el mismo lote
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

    const tipoTurno = tipo || 'REGULAR';
    const [result] = await db.query(
      `INSERT INTO turnos_riego (persona_id, lote_id, tipo, dia_semana, hora_inicio, hora_fin, vigencia_desde, observacion)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [persona_id, lote_id, tipoTurno, dia_semana, hora_inicio, hora_fin, vigencia_desde || null, observacion || null]
    );

    const turnoId = result.insertId;

    // Si es un turno ADICIONAL o tiene un costo asignado, generar cobro/deuda automáticamente en la cuenta del comunero
    let obligacionId = null;
    const montoTurno = costo !== undefined && costo !== null && costo !== '' ? parseFloat(costo) : (tipoTurno === 'ADICIONAL' ? 5.00 : 0);

    if (montoTurno > 0) {
      // Buscar o registrar concepto TURNO_ADICIONAL
      let [conceptos] = await db.query(`SELECT id FROM conceptos_cobro WHERE codigo = 'TURNO_ADICIONAL'`);
      let conceptoId;
      if (conceptos.length === 0) {
        const [newConc] = await db.query(
          `INSERT INTO conceptos_cobro (codigo, nombre, descripcion) VALUES ('TURNO_ADICIONAL', 'Turno Adicional de Agua', 'Cobro por asignación de turno adicional de riego')`
        );
        conceptoId = newConc.insertId;
      } else {
        conceptoId = conceptos[0].id;
      }

      const now = new Date();
      const anio = now.getFullYear();
      const mes = now.getMonth() + 1;

      // Obtener datos del lote para la observación
      const [[loteInfo]] = await db.query(`SELECT codigo FROM lotes WHERE id = ?`, [lote_id]);
      const loteCodigo = loteInfo ? loteInfo.codigo : `ID ${lote_id}`;

      const diasNombres = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
      const diaTexto = diasNombres[dia_semana] || dia_semana;

      const obsTexto = `Generado automáticamente por asignación de Turno Adicional (${diaTexto} ${hora_inicio}-${hora_fin}, Lote ${loteCodigo})${observacion ? ' - ' + observacion : ''}`;

      // Verificar si ya existe una obligación para este comunero, concepto y período (año/mes)
      const [existingObl] = await db.query(
        `SELECT id, valor, observacion, estado FROM obligaciones 
         WHERE persona_id = ? AND concepto_id = ? AND periodo_anio = ? AND periodo_mes = ?`,
        [persona_id, conceptoId, anio, mes]
      );

      if (existingObl.length > 0) {
        const obl = existingObl[0];
        if (obl.estado === 'PENDIENTE') {
          // Si la obligación existe y está pendiente, acumular el valor y concatenar la observación
          const nuevoValor = Number(obl.valor) + montoTurno;
          const nuevaObs = `${obl.observacion || ''} | ${obsTexto}`;
          await db.query(
            `UPDATE obligaciones SET valor = ?, observacion = ? WHERE id = ?`,
            [nuevoValor, nuevaObs, obl.id]
          );
          obligacionId = obl.id;
        } else {
          // Si la obligación ya fue PAGADA o ANULADA, crear una nueva sin periodo_mes para no violar el UNIQUE KEY
          const [resObligacion] = await db.query(
            `INSERT INTO obligaciones (persona_id, concepto_id, periodo_anio, periodo_mes, fecha_emision, valor, origen, estado, observacion)
             VALUES (?, ?, ?, NULL, CURDATE(), ?, 'AUTOMATICA', 'PENDIENTE', ?)`,
            [persona_id, conceptoId, anio, montoTurno, obsTexto]
          );
          obligacionId = resObligacion.insertId;
        }
      } else {
        // Primera obligación del período, insertar normalmente
        const [resObligacion] = await db.query(
          `INSERT INTO obligaciones (persona_id, concepto_id, periodo_anio, periodo_mes, fecha_emision, valor, origen, estado, observacion)
           VALUES (?, ?, ?, ?, CURDATE(), ?, 'AUTOMATICA', 'PENDIENTE', ?)`,
          [persona_id, conceptoId, anio, mes, montoTurno, obsTexto]
        );
        obligacionId = resObligacion.insertId;
      }
    }

    await registrarAuditoria({
      cuentaId: req.user ? req.user.cuentaId : null,
      accion: 'CREAR',
      entidad: 'turnos_riego',
      entidadId: turnoId,
      ip: req.ip,
      detalle: { persona_id, lote_id, tipo: tipoTurno, dia_semana, hora_inicio, hora_fin, montoTurno, obligacionId }
    });

    const msg = obligacionId
      ? `Turno de agua asignado con éxito. Se generó un cobro automático de $${montoTurno.toFixed(2)} a la cuenta del comunero.`
      : 'Turno de agua asignado correctamente.';

    return res.status(201).json({ status: 'OK', message: msg, turnoId, obligacionId });
  } catch (error) {
    next(error);
  }
}

/**
 * Actualizar turno de agua de riego
 */
async function updateTurno(req, res, next) {
  try {
    const { id } = req.params;
    const { persona_id, lote_id, tipo, dia_semana, hora_inicio, hora_fin, observacion } = req.body;

    if (!dia_semana || !hora_inicio || !hora_fin) {
      return res.status(400).json({ status: 'ERROR', message: 'Día de la semana, hora de inicio y fin son obligatorios.' });
    }

    if (hora_inicio >= hora_fin) {
      return res.status(400).json({ status: 'ERROR', message: 'La hora de inicio debe ser menor a la hora de finalización.' });
    }

    // Validar solapamientos excluyendo el turno actual
    if (lote_id) {
      const [solapados] = await db.query(
        `SELECT id FROM turnos_riego
         WHERE lote_id = ? AND dia_semana = ? AND estado = 'ACTIVO' AND id != ?
           AND (? < hora_fin AND ? > hora_inicio)`,
        [lote_id, dia_semana, id, hora_inicio, hora_fin]
      );

      if (solapados.length > 0) {
        return res.status(400).json({
          status: 'ERROR',
          message: 'Existe un conflicto de horarios. El lote ya tiene asignado un turno de agua que se solapa en el mismo día y horario.'
        });
      }
    }

    await db.query(
      `UPDATE turnos_riego
       SET persona_id = COALESCE(?, persona_id),
           lote_id = COALESCE(?, lote_id),
           tipo = COALESCE(?, tipo),
           dia_semana = ?,
           hora_inicio = ?,
           hora_fin = ?,
           observacion = ?
       WHERE id = ?`,
      [persona_id || null, lote_id || null, tipo || 'REGULAR', dia_semana, hora_inicio, hora_fin, observacion || null, id]
    );

    await registrarAuditoria({
      cuentaId: req.user ? req.user.cuentaId : null,
      accion: 'MODIFICAR',
      entidad: 'turnos_riego',
      entidadId: id,
      ip: req.ip,
      detalle: { persona_id, lote_id, dia_semana, hora_inicio, hora_fin }
    });

    return res.json({ status: 'OK', message: 'Turno de agua actualizado correctamente.' });
  } catch (error) {
    next(error);
  }
}

/**
 * Eliminar / Desactivar turno de agua
 */
async function deleteTurno(req, res, next) {
  try {
    const { id } = req.params;

    await db.query(`UPDATE turnos_riego SET estado = 'INACTIVO' WHERE id = ?`, [id]);

    await registrarAuditoria({
      cuentaId: req.user ? req.user.cuentaId : null,
      accion: 'ELIMINAR',
      entidad: 'turnos_riego',
      entidadId: id,
      ip: req.ip,
      detalle: { id }
    });

    return res.json({ status: 'OK', message: 'Turno de agua eliminado con éxito.' });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getTurnos,
  createTurno,
  updateTurno,
  deleteTurno
};
