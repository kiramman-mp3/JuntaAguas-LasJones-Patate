const fs = require('fs');
const path = require('path');
const db = require('../config/db');
const { registrarAuditoria } = require('../services/auditService');

async function asegurarTablaDocumentos() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS documentos_evento (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        evento_id BIGINT NOT NULL,
        tipo ENUM('CONVOCATORIA', 'ACTA', 'RESOLUCION', 'OTRO') NOT NULL,
        estado ENUM('GENERADO', 'FIRMADO') NOT NULL DEFAULT 'GENERADO',
        nombre_archivo VARCHAR(255) NOT NULL DEFAULT 'documento.pdf',
        contenido_base64 LONGTEXT,
        ruta_archivo_firmado LONGTEXT,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (evento_id) REFERENCES eventos(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);

    try {
      await db.query(`ALTER TABLE documentos_evento ADD COLUMN contenido_base64 LONGTEXT`);
    } catch (e) { /* Ignorar error si ya existe */ }

    try {
      await db.query(`ALTER TABLE documentos_evento ADD COLUMN nombre_archivo VARCHAR(255) DEFAULT 'documento.pdf'`);
    } catch (e) { /* Ignorar error si ya existe */ }

    try {
      await db.query(`ALTER TABLE documentos_evento MODIFY COLUMN ruta_archivo_firmado LONGTEXT`);
    } catch (e) { /* Ignorar error */ }

    try {
      await db.query(`ALTER TABLE documentos_evento MODIFY COLUMN nombre_archivo_generado VARCHAR(255) NULL`);
    } catch (e) { /* Ignorar error */ }

    try {
      await db.query(`ALTER TABLE documentos_evento MODIFY COLUMN ruta_archivo_generado VARCHAR(500) NULL`);
    } catch (e) { /* Ignorar error */ }

    try {
      await db.query(`ALTER TABLE documentos_evento MODIFY COLUMN fecha_generacion DATETIME NULL`);
    } catch (e) { /* Ignorar error */ }

    try {
      await db.query(`ALTER TABLE documentos_evento MODIFY COLUMN generado_por_cuenta_id BIGINT NULL`);
    } catch (e) { /* Ignorar error */ }

  } catch (err) {
    console.error('Error asegurando tabla documentos_evento:', err);
  }
}

/**
 * Listar eventos (Asambleas y Mingas)
 */
async function getEventos(req, res, next) {
  try {
    await asegurarTablaDocumentos();
    const { tipo, estado, desde, hasta } = req.query;

    let sql = `SELECT e.*, CONCAT(p.nombres, ' ', p.apellidos) AS creado_por_usuario,
                      (SELECT COUNT(*) FROM asistencias a WHERE a.evento_id = e.id AND a.estado = 'PRESENTE') AS asistentes,
                      (SELECT COUNT(*) FROM personas p2 WHERE p2.estado = 'ACTIVO') AS totalComuneros,
                      (SELECT ruta_archivo_firmado FROM documentos_evento d WHERE d.evento_id = e.id AND d.tipo = 'CONVOCATORIA' LIMIT 1) AS convocatoria_firmada_url,
                      (SELECT nombre_archivo FROM documentos_evento d WHERE d.evento_id = e.id AND d.tipo = 'CONVOCATORIA' LIMIT 1) AS convocatoria_firmada_nombre,
                      (SELECT ruta_archivo_firmado FROM documentos_evento d WHERE d.evento_id = e.id AND d.tipo = 'ACTA' LIMIT 1) AS acta_firmada_url,
                      (SELECT nombre_archivo FROM documentos_evento d WHERE d.evento_id = e.id AND d.tipo = 'ACTA' LIMIT 1) AS acta_firmada_nombre
               FROM eventos e
               LEFT JOIN cuentas c ON c.id = e.created_by_cuenta_id
               LEFT JOIN personas p ON p.id = c.persona_id
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
 * Obtener eventos próximos para la landing page (solo Programados)
 */
async function getEventosPublicos(req, res, next) {
  try {
    const [eventos] = await db.query(
      `SELECT id, tipo, titulo, descripcion, fecha, hora_inicio, lugar
       FROM eventos
       WHERE estado = 'PROGRAMADO' AND fecha >= CURDATE()
       ORDER BY fecha ASC, hora_inicio ASC
       LIMIT 3`
    );
    return res.json({ status: 'OK', eventos });
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

    const [eventos] = await db.query(
      `SELECT e.*,
              (SELECT ruta_archivo_firmado FROM documentos_evento d WHERE d.evento_id = e.id AND d.tipo = 'CONVOCATORIA' LIMIT 1) AS convocatoria_firmada_url,
              (SELECT nombre_archivo FROM documentos_evento d WHERE d.evento_id = e.id AND d.tipo = 'CONVOCATORIA' LIMIT 1) AS convocatoria_firmada_nombre,
              (SELECT ruta_archivo_firmado FROM documentos_evento d WHERE d.evento_id = e.id AND d.tipo = 'ACTA' LIMIT 1) AS acta_firmada_url,
              (SELECT nombre_archivo FROM documentos_evento d WHERE d.evento_id = e.id AND d.tipo = 'ACTA' LIMIT 1) AS acta_firmada_nombre
       FROM eventos e WHERE e.id = ?`,
      [id]
    );
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
 * Obtener asistencias registradas de un evento
 */
async function getAsistencias(req, res, next) {
  try {
    const { id } = req.params;

    const [asistencias] = await db.query(
      `SELECT a.persona_id, a.estado, a.hora_registro, a.motivo_justificacion
       FROM asistencias a
       WHERE a.evento_id = ?
       ORDER BY a.persona_id`,
      [id]
    );

    return res.json({ status: 'OK', data: asistencias });
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

/**
 * Guardar o actualizar un documento PDF (firmado) para un evento
 */
async function guardarDocumentoEvento(req, res, next) {
  try {
    await asegurarTablaDocumentos();
    const { id } = req.params;
    const { tipo, nombre_archivo, contenido_base64, estado } = req.body;

    if (!tipo || !contenido_base64) {
      return res.status(400).json({ status: 'ERROR', message: 'El tipo y el contenido del documento son requeridos.' });
    }

    const docNombre = nombre_archivo || `${tipo}_Firmado.pdf`;

    // Guardar archivo físico en el servidor (disco)
    const base64Clean = contenido_base64.replace(/^data:application\/pdf;base64,/, '').replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Clean, 'base64');

    const uploadsDir = path.join(__dirname, '../../uploads/documentos');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const safeFileName = `${tipo.toLowerCase()}_evento_${id}_${Date.now()}.pdf`;
    const filePathOnDisk = path.join(uploadsDir, safeFileName);
    fs.writeFileSync(filePathOnDisk, buffer);

    const relativeUrl = `/uploads/documentos/${safeFileName}`;

    const [existente] = await db.query(
      `SELECT id, ruta_archivo_firmado FROM documentos_evento WHERE evento_id = ? AND tipo = ?`,
      [id, tipo]
    );

    const cuentaId = req.user ? req.user.cuentaId : 1;

    if (existente.length > 0) {
      // Eliminar el archivo físico anterior del disco para no acumular basura
      const oldUrl = existente[0].ruta_archivo_firmado;
      if (oldUrl && oldUrl.startsWith('/uploads/')) {
        const oldFilePathOnDisk = path.join(__dirname, '../../', oldUrl);
        if (fs.existsSync(oldFilePathOnDisk)) {
          try {
            fs.unlinkSync(oldFilePathOnDisk);
          } catch (err) {
            console.error('Error al eliminar archivo previo del servidor:', err);
          }
        }
      }

      await db.query(
        `UPDATE documentos_evento 
         SET nombre_archivo = ?, ruta_archivo_firmado = ?, ruta_archivo_generado = ?, estado = ?, updated_at = NOW()
         WHERE evento_id = ? AND tipo = ?`,
        [docNombre, relativeUrl, relativeUrl, estado || 'FIRMADO', id, tipo]
      );
    } else {
      await db.query(
        `INSERT INTO documentos_evento (evento_id, tipo, estado, nombre_archivo, ruta_archivo_firmado, nombre_archivo_generado, ruta_archivo_generado, fecha_generacion, generado_por_cuenta_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?)`,
        [id, tipo, estado || 'FIRMADO', docNombre, relativeUrl, docNombre, relativeUrl, cuentaId]
      );
    }

    await registrarAuditoria({
      cuentaId: req.user ? req.user.cuentaId : 1,
      accion: 'CREAR',
      entidad: 'documentos_evento',
      entidadId: parseInt(id),
      ip: req.ip,
      detalle: { tipo, nombre_archivo: docNombre, url: relativeUrl }
    });

    return res.json({ status: 'OK', message: 'Documento firmado guardado exitosamente en el servidor.', url: relativeUrl });
  } catch (error) {
    next(error);
  }
}

/**
 * Obtener los documentos de un evento
 */
async function getDocumentosEvento(req, res, next) {
  try {
    await asegurarTablaDocumentos();
    const { id } = req.params;
    const [docs] = await db.query(
      `SELECT id, evento_id, tipo, estado, nombre_archivo, contenido_base64, updated_at FROM documentos_evento WHERE evento_id = ?`,
      [id]
    );
    return res.json({ status: 'OK', data: docs });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getEventos,
  getEventosPublicos,
  getEventoById,
  createEvento,
  savePuntosAsamblea,
  registrarAsistencias,
  getAsistencias,
  finalizarEventoYGenerarMultas,
  guardarDocumentoEvento,
  getDocumentosEvento
};

