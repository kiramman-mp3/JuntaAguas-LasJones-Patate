const db = require('../config/db');
const { registrarAuditoria } = require('../services/auditService');

/**
 * Listar eventos (Asambleas y Mingas)
 */
async function getEventos(req, res, next) {
  try {
    const { tipo, estado, desde, hasta } = req.query;

    let sql = `SELECT e.*, c.usuario AS creado_por_usuario
               FROM eventos e
               LEFT JOIN cuentas c ON c.id = e.created_by_cuenta_id
               WHERE 1=1`;
    const params = [];

    if (tipo) {
      sql += ` AND e.tipo = ?`;
      params.push(tipo);
    }
    if (estado) {
      sql += ` AND e.estado = ?`;
      params.push(estado);
    }
    if (desde) {
      sql += ` AND e.fecha >= ?`;
      params.push(desde);
    }
    if (hasta) {
      sql += ` AND e.fecha <= ?`;
      params.push(hasta);
    }

    sql += ` ORDER BY e.fecha DESC, e.hora_inicio DESC`;

    const [eventos] = await db.query(sql, params);
    return res.json({ status: 'OK', data: eventos });
  } catch (error) {
    next(error);
  }
}

/**
 * Obtener detalle de un evento (con puntos de asamblea y estadísticas de asistencia)
 */
async function getEventoById(req, res, next) {
  try {
    const { id } = req.params;

    const [eventos] = await db.query(`SELECT * FROM eventos WHERE id = ?`, [id]);
    if (eventos.length === 0) {
      return res.status(404).json({ status: 'ERROR', message: 'Evento no encontrado.' });
    }

    const evento = eventos[0];

    // Puntos de asamblea si aplica
    const [puntos] = await db.query(`SELECT * FROM puntos_asamblea WHERE evento_id = ? ORDER BY orden ASC`, [id]);

    // Resumen de asistencia
    const [asistenciaStats] = await db.query(
      `SELECT estado, COUNT(*) AS total
       FROM asistencias WHERE evento_id = ?
       GROUP BY estado`,
      [id]
    );

    return res.json({
      status: 'OK',
      evento,
      puntos,
      asistenciaStats
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Crear nuevo evento (Asamblea o Minga)
 */
async function createEvento(req, res, next) {
  try {
    const { tipo, titulo, descripcion, fecha, hora_inicio, hora_fin, lugar, requiere_asistencia, genera_multa_ausencia, valor_multa } = req.body;

    if (!tipo || !titulo || !fecha || !hora_inicio) {
      return res.status(400).json({ status: 'ERROR', message: 'Tipo, título, fecha y hora de inicio son obligatorios.' });
    }

    const [result] = await db.query(
      `INSERT INTO eventos (tipo, titulo, descripcion, fecha, hora_inicio, hora_fin, lugar, requiere_asistencia, genera_multa_ausencia, valor_multa, created_by_cuenta_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tipo,
        titulo.trim(),
        descripcion || null,
        fecha,
        hora_inicio,
        hora_fin || null,
        lugar || 'Casa Comunal Junta La Jones',
        requiere_asistencia !== undefined ? requiere_asistencia : true,
        genera_multa_ausencia !== undefined ? genera_multa_ausencia : true,
        valor_multa || 10.00,
        req.user.cuentaId
      ]
    );

    const eventoId = result.insertId;

    await registrarAuditoria({
      cuentaId: req.user.cuentaId,
      accion: 'CREAR',
      entidad: 'eventos',
      entidadId: eventoId,
      ip: req.ip,
      detalle: { tipo, titulo, fecha, genera_multa_ausencia, valor_multa }
    });

    return res.status(201).json({ status: 'OK', message: 'Evento registrado exitosamente.', eventoId });
  } catch (error) {
    next(error);
  }
}

/**
 * Guardar puntos del orden del día y resoluciones para asambleas
 */
async function savePuntosAsamblea(req, res, next) {
  try {
    const { id } = req.params;
    const { puntos } = req.body; // Array de { orden, punto_tratar, tratado, resolucion }

    const [evento] = await db.query(`SELECT tipo FROM eventos WHERE id = ?`, [id]);
    if (evento.length === 0) {
      return res.status(404).json({ status: 'ERROR', message: 'Evento no encontrado.' });
    }
    if (evento[0].tipo !== 'ASAMBLEA') {
      return res.status(400).json({ status: 'ERROR', message: 'Los puntos del orden del día solo aplican a eventos de tipo ASAMBLEA.' });
    }

    if (!Array.isArray(puntos)) {
      return res.status(400).json({ status: 'ERROR', message: 'Formato de puntos inválido.' });
    }

    // Reemplazar puntos
    await db.query(`DELETE FROM puntos_asamblea WHERE evento_id = ?`, [id]);

    for (const p of puntos) {
      await db.query(
        `INSERT INTO puntos_asamblea (evento_id, orden, punto_tratar, tratado, resolucion)
         VALUES (?, ?, ?, ?, ?)`,
        [id, p.orden, p.punto_tratar, p.tratado || null, p.resolucion || null]
      );
    }

    return res.json({ status: 'OK', message: 'Puntos del orden del día guardados correctamente.' });
  } catch (error) {
    next(error);
  }
}

/**
 * Registrar / Actualizar asistencia masiva de comuneros
 */
async function registrarAsistencias(req, res, next) {
  try {
    const { id } = req.params;
    const { asistencias } = req.body; // Array de { persona_id, estado, motivo_justificacion }

    if (!Array.isArray(asistencias)) {
      return res.status(400).json({ status: 'ERROR', message: 'Se requiere una lista de asistencias.' });
    }

    for (const a of asistencias) {
      await db.query(
        `INSERT INTO asistencias (evento_id, persona_id, estado, hora_registro, motivo_justificacion, registrado_por_cuenta_id)
         VALUES (?, ?, ?, NOW(), ?, ?)
         ON DUPLICATE KEY UPDATE
           estado = VALUES(estado),
           hora_registro = NOW(),
           motivo_justificacion = VALUES(motivo_justificacion),
           registrado_por_cuenta_id = VALUES(registrado_por_cuenta_id)`,
        [id, a.persona_id, a.estado || 'PENDIENTE', a.motivo_justificacion || null, req.user.cuentaId]
      );
    }

    return res.json({ status: 'OK', message: 'Asistencias registradas exitosamente.' });
  } catch (error) {
    next(error);
  }
}

/**
 * FINALIZAR EVENTO Y GENERACIÓN AUTOMÁTICA DE MULTAS POR AUSENCIA
 */
async function finalizarEventoYGenerarMultas(req, res, next) {
  const connection = await db.getConnection();
  try {
    const { id } = req.params;

    await connection.beginTransaction();

    const [eventos] = await connection.query(`SELECT * FROM eventos WHERE id = ? FOR UPDATE`, [id]);
    if (eventos.length === 0) {
      await connection.rollback();
      return res.status(404).json({ status: 'ERROR', message: 'Evento no encontrado.' });
    }

    const evento = eventos[0];

    // Actualizar estado del evento a REALIZADO
    await connection.query(`UPDATE eventos SET estado = 'REALIZADO' WHERE id = ?`, [id]);

    let multasGeneradas = 0;

    // Verificar si el evento genera multa automática por ausencia
    if (evento.genera_multa_ausencia && Number(evento.valor_multa) > 0) {
      // Buscar el concepto de cobro según el tipo de evento
      const codigoConcepto = evento.tipo === 'ASAMBLEA' ? 'MULTA_ASAMBLEA' : 'MULTA_MINGA';
      const [conceptos] = await connection.query(`SELECT id FROM conceptos_cobro WHERE codigo = ?`, [codigoConcepto]);

      if (conceptos.length > 0) {
        const conceptoId = conceptos[0].id;

        // Obtener personas ausentes en el evento
        const [ausentes] = await connection.query(
          `SELECT persona_id FROM asistencias WHERE evento_id = ? AND estado = 'AUSENTE'`,
          [id]
        );

        const fechaEvento = new Date(evento.fecha);
        const anio = fechaEvento.getFullYear();
        const mes = fechaEvento.getMonth() + 1;

        for (const a of ausentes) {
          // Insertar obligación de multa automática (evita duplicados con uq_multa_persona_evento_concepto)
          const [resMulta] = await connection.query(
            `INSERT IGNORE INTO obligaciones (persona_id, concepto_id, evento_id, periodo_anio, periodo_mes, fecha_emision, valor, origen, estado, observacion)
             VALUES (?, ?, ?, ?, ?, CURDATE(), ?, 'AUTOMATICA', 'PENDIENTE', ?)`,
            [a.persona_id, conceptoId, id, anio, mes, evento.valor_multa, `Multa por ausencia a ${evento.tipo}: ${evento.titulo}`]
          );

          if (resMulta.affectedRows > 0) {
            multasGeneradas++;
          }
        }
      }
    }

    await connection.commit();

    await registrarAuditoria({
      cuentaId: req.user.cuentaId,
      accion: 'MODIFICAR',
      entidad: 'eventos',
      entidadId: parseInt(id),
      ip: req.ip,
      detalle: { finalizarEvento: true, multasGeneradas }
    });

    return res.json({
      status: 'OK',
      message: `Evento finalizado exitosamente. Se generaron ${multasGeneradas} multas automáticas por inasistencia.`,
      multasGeneradas
    });

  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
}

module.exports = {
  getEventos,
  getEventoById,
  createEvento,
  savePuntosAsamblea,
  registrarAsistencias,
  finalizarEventoYGenerarMultas
};
