const db = require('../config/db');
const { registrarAuditoria } = require('../services/auditService');
const PDFDocument = require('pdfkit');
const { guardarDocumento, eliminarDocumento } = require('../services/documentStorage');
const { badRequest, notFound } = require('../shared/errors');
const { z, idParam } = require('../shared/schemas');

/**
 * Listar eventos (Asambleas y Mingas)
 */
async function getEventos(req, res, next) {
  try {
    const { tipo, estado, desde, hasta } = req.query;

    let sql = `SELECT e.id, e.tipo, e.titulo, e.descripcion, e.fecha, e.hora_inicio, e.hora_fin,
                      e.lugar, e.estado, e.requiere_asistencia, e.genera_multa_ausencia, e.valor_multa,
                      e.created_by_cuenta_id, e.created_at,
                      CONCAT(p.nombres, ' ', p.apellidos) AS creado_por_usuario,
                      (SELECT COUNT(*) FROM asistencias a WHERE a.evento_id = e.id AND a.estado = 'PRESENTE') AS asistentes,
                      (SELECT COUNT(*) FROM personas p2 WHERE p2.estado = 'ACTIVO') AS totalComuneros,
                      (SELECT ruta_archivo_firmado FROM documentos_evento d WHERE d.evento_id = e.id AND d.tipo = 'CONVOCATORIA' LIMIT 1) AS convocatoria_firmada_url,
                      (SELECT nombre_archivo FROM documentos_evento d WHERE d.evento_id = e.id AND d.tipo = 'CONVOCATORIA' LIMIT 1) AS convocatoria_firmada_nombre,
                      (SELECT ruta_archivo_firmado FROM documentos_evento d WHERE d.evento_id = e.id AND d.tipo = 'ACTA' LIMIT 1) AS acta_firmada_url,
                      (SELECT nombre_archivo FROM documentos_evento d WHERE d.evento_id = e.id AND d.tipo = 'ACTA' LIMIT 1) AS acta_firmada_nombre,
                      NULL AS lista_asistencia_url,
                      (SELECT ruta_archivo_firmado FROM documentos_evento d WHERE d.evento_id = e.id AND d.tipo = 'OTRO' AND d.ruta_archivo_firmado IS NOT NULL LIMIT 1) AS lista_asistencia_firmada_url
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
async function getEventosPublicos(req, res) {
  const limite = Math.min(Math.max(Number.parseInt(req.query.limite, 10) || 20, 1), 50);
  // Solo eventos ya anunciados y sin datos personales. La convocatoria firmada se expone
  // porque es un documento público dirigido a todos los comuneros.
  const [eventos] = await db.query(
    `SELECT e.id, e.tipo, e.titulo, e.descripcion, e.fecha, e.hora_inicio, e.hora_fin, e.lugar, e.estado,
            e.genera_multa_ausencia, e.valor_multa,
            (SELECT d.ruta_archivo_firmado FROM documentos_evento d
              WHERE d.evento_id = e.id AND d.tipo = 'CONVOCATORIA' AND d.ruta_archivo_firmado IS NOT NULL LIMIT 1) AS convocatoria_firmada_url
     FROM eventos e
     WHERE e.estado IN ('PROGRAMADO', 'CONVOCADO') AND e.fecha >= ?
     ORDER BY e.fecha ASC, e.hora_inicio ASC
     LIMIT ?`,
    [require('../shared/dates').hoy(), limite]
  );
  return res.json({ status: 'OK', data: eventos, eventos });
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
              (SELECT nombre_archivo FROM documentos_evento d WHERE d.evento_id = e.id AND d.tipo = 'ACTA' LIMIT 1) AS acta_firmada_nombre,
              NULL AS lista_asistencia_url,
              (SELECT ruta_archivo_firmado FROM documentos_evento d WHERE d.evento_id = e.id AND d.tipo = 'OTRO' AND d.ruta_archivo_firmado IS NOT NULL LIMIT 1) AS lista_asistencia_firmada_url
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

    if (tipo === 'ASAMBLEA') {
      const hoyStr = new Date().toISOString().split('T')[0];
      const fechaStr = typeof fecha === 'string' ? fecha.split('T')[0] : '';
      if (fechaStr && fechaStr < hoyStr) {
        return res.status(400).json({ status: 'ERROR', message: 'La fecha de la asamblea no puede ser anterior a la fecha actual.' });
      }
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

    if (tipo === 'ASAMBLEA' && Array.isArray(req.body.puntos_orden_dia) && req.body.puntos_orden_dia.length > 0) {
      for (let i = 0; i < req.body.puntos_orden_dia.length; i++) {
        const item = req.body.puntos_orden_dia[i];
        const puntoTexto = typeof item === 'string' ? item.trim() : (item && item.punto_tratar ? item.punto_tratar.trim() : '');
        if (puntoTexto) {
          try {
            await db.query(
              `INSERT INTO puntos_asamblea (evento_id, orden, punto_tratar, tratado, resolucion, titulo_acta)
               VALUES (?, ?, ?, ?, ?, ?)`,
              [eventoId, i + 1, puntoTexto, (typeof item === 'object' ? item.tratado : null) || null, (typeof item === 'object' ? item.resolucion : null) || null, puntoTexto]
            );
          } catch (pErr) {
            console.error('Error insertando punto de orden del día inicial:', pErr);
          }
        }
      }
    }

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
 * Guardar puntos del orden del día y resoluciones para asambleas (soporte múltiples actas F07)
 */
async function savePuntosAsamblea(req, res, next) {
  try {
    const { id } = req.params;
    const { puntos } = req.body; // Array de { id, orden, punto_tratar, tratado, resolucion, responsables, titulo_acta, estado_acta }

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

    const connection = await db.getConnection();
    try {
      await connection.query('BEGIN');

      const [existentes] = await connection.query(`SELECT * FROM puntos_asamblea WHERE evento_id = ?`, [id]);
      const mapaExistentes = new Map(existentes.map(e => [e.id, e]));

      // Reemplazar puntos manteniendo actas firmadas y estados previos si aplican
      await connection.query(`DELETE FROM puntos_asamblea WHERE evento_id = ?`, [id]);

      for (let i = 0; i < puntos.length; i++) {
        const p = puntos[i];
        const orden = p.orden !== undefined ? p.orden : (i + 1);
        const puntoTexto = (p.punto_tratar || p.titulo_acta || '').trim();
        if (!puntoTexto) continue;

        const previo = (p.id && mapaExistentes.get(p.id)) || existentes.find(e => e.orden === orden);
        const tituloActa = p.titulo_acta || puntoTexto;
        const estadoActa = p.estado_acta || (previo ? previo.estado_acta : 'BORRADOR');
        const actaFirmadaUrl = p.acta_firmada_url !== undefined ? p.acta_firmada_url : (previo ? previo.acta_firmada_url : null);
        const actaFirmadaNombre = p.acta_firmada_nombre !== undefined ? p.acta_firmada_nombre : (previo ? previo.acta_firmada_nombre : null);
        const responsables = p.responsables !== undefined ? p.responsables : (previo ? previo.responsables : null);
        const fechaActa = p.fecha_acta || (previo ? previo.fecha_acta : null);

        await connection.query(
          `INSERT INTO puntos_asamblea (evento_id, orden, punto_tratar, tratado, resolucion, titulo_acta, estado_acta, acta_firmada_url, acta_firmada_nombre, responsables, fecha_acta)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [id, orden, puntoTexto, p.tratado || null, p.resolucion || null, tituloActa, estadoActa, actaFirmadaUrl, actaFirmadaNombre, responsables, fechaActa]
        );
      }

      await connection.query('COMMIT');
      connection.release();

      const [puntosActualizados] = await db.query(`SELECT * FROM puntos_asamblea WHERE evento_id = ? ORDER BY orden ASC`, [id]);
      return res.json({ status: 'OK', message: 'Puntos del orden del día y actas guardados correctamente.', data: puntosActualizados, puntos: puntosActualizados });
    } catch (txError) {
      await connection.query('ROLLBACK');
      connection.release();
      throw txError;
    }
  } catch (error) {
    next(error);
  }
}

/**
 * Cambiar estado de una asamblea (BORRADOR, PROGRAMADO, CONVOCADO, CANCELADO)
 */
async function cambiarEstado(req, res, next) {
  try {
    const { id } = req.params;
    const { estado } = req.body;

    const permitidos = ['BORRADOR', 'PROGRAMADO', 'CONVOCADO', 'CANCELADO'];
    if (!permitidos.includes(estado)) {
      return res.status(400).json({
        status: 'ERROR',
        message: 'Estado inválido. Opciones permitidas: ' + permitidos.join(', ')
      });
    }

    const [eventos] = await db.query('SELECT * FROM eventos WHERE id = ?', [id]);
    if (eventos.length === 0) {
      return res.status(404).json({ status: 'ERROR', message: 'Evento no encontrado.' });
    }

    const evento = eventos[0];
    if (evento.estado === 'REALIZADO') {
      return res.status(409).json({ status: 'ERROR', message: 'No se puede modificar el estado de un evento ya realizado.' });
    }

    await db.query('UPDATE eventos SET estado = ? WHERE id = ?', [estado, id]);

    await registrarAuditoria({
      cuentaId: req.user ? req.user.cuentaId : 1,
      accion: 'MODIFICAR',
      entidad: 'eventos',
      entidadId: parseInt(id),
      ip: req.ip,
      detalle: { estadoAnterior: evento.estado, nuevoEstado: estado }
    });

    return res.json({
      status: 'OK',
      message: `Estado de la asamblea actualizado a ${estado}.`,
      estado
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Cambiar estado o detalles del acta de un punto específico (F07)
 */
async function cambiarEstadoActaPunto(req, res, next) {
  try {
    const { id, puntoId } = req.params;
    const { estado_acta, resolucion, tratado, responsables, titulo_acta } = req.body;

    const [puntos] = await db.query('SELECT * FROM puntos_asamblea WHERE id = ? AND evento_id = ?', [puntoId, id]);
    if (puntos.length === 0) {
      return res.status(404).json({ status: 'ERROR', message: 'Punto de asamblea no encontrado.' });
    }

    let sql = 'UPDATE puntos_asamblea SET updated_at = NOW()';
    const params = [];

    if (estado_acta) {
      sql += ', estado_acta = ?';
      params.push(estado_acta);
    }
    if (resolucion !== undefined) {
      sql += ', resolucion = ?';
      params.push(resolucion);
    }
    if (tratado !== undefined) {
      sql += ', tratado = ?';
      params.push(tratado);
    }
    if (responsables !== undefined) {
      sql += ', responsables = ?';
      params.push(responsables);
    }
    if (titulo_acta !== undefined) {
      sql += ', titulo_acta = ?';
      params.push(titulo_acta);
    }

    sql += ' WHERE id = ? AND evento_id = ?';
    params.push(puntoId, id);

    await db.query(sql, params);

    const [actualizado] = await db.query('SELECT * FROM puntos_asamblea WHERE id = ?', [puntoId]);

    return res.json({
      status: 'OK',
      message: 'Acta del punto actualizada exitosamente.',
      data: actualizado[0] || null
    });
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

    if (evento.estado === 'REALIZADO') {
      await connection.rollback();
      return res.status(409).json({ status: 'ERROR', message: 'El evento ya fue finalizado previamente.' });
    }

    if (evento.estado === 'CANCELADO') {
      await connection.rollback();
      return res.status(409).json({ status: 'ERROR', message: 'No se puede finalizar un evento que ha sido cancelado.' });
    }

    if (evento.estado === 'BORRADOR') {
      await connection.rollback();
      return res.status(409).json({ status: 'ERROR', message: 'No se puede finalizar una asamblea en borrador. Debe ser convocada previamente.' });
    }

    // Validar que la fecha de la asamblea no sea futura
    const hoyStr = new Date().toISOString().split('T')[0];
    const fechaEventoStr = typeof evento.fecha === 'string'
      ? evento.fecha.split('T')[0]
      : (evento.fecha instanceof Date ? evento.fecha.toISOString().split('T')[0] : '');

    if (fechaEventoStr && fechaEventoStr > hoyStr) {
      await connection.rollback();
      return res.status(409).json({
        status: 'ERROR',
        message: `No se puede finalizar una asamblea antes de su fecha programada (${fechaEventoStr}). Si la asamblea no se va a realizar, utilice la opción Cancelar Asamblea.`
      });
    }

    // Validar que se haya registrado la asistencia de los comuneros
    const [asistenciasRegistradas] = await connection.query(
      `SELECT COUNT(*) AS total FROM asistencias WHERE evento_id = ?`,
      [id]
    );

    const totalAsistencias = asistenciasRegistradas[0]?.total || 0;
    if (totalAsistencias === 0) {
      await connection.rollback();
      return res.status(409).json({
        status: 'ERROR',
        message: 'No se puede finalizar la asamblea sin haber registrado la asistencia de los comuneros. Tome y guarde la lista de asistencia antes de finalizar.'
      });
    }

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

const documentoSchema = z.object({
  tipo: z.enum(['CONVOCATORIA', 'ACTA', 'RESOLUCION', 'OTRO'], { error: 'Tipo de documento inválido.' }),
  punto_id: z.coerce.number().int().positive().optional()
});

/** Nombre original solo para mostrarlo: sin rutas ni caracteres de control. */
function nombreVisible(original, respaldo) {
  const base = String(original || '').split(/[\\/]/u).pop().replace(/[^\p{L}\p{N} ._()-]/gu, '').trim();
  return (base || respaldo).slice(0, 255);
}

/**
 * Guardar el documento firmado (PDF o imagen escaneada) de un evento o del acta de un punto.
 * Recibe multipart/form-data con el campo "archivo". El tipo real del archivo se valida por su contenido.
 */
async function guardarDocumentoEvento(req, res) {
  const { id } = idParam.parse(req.params);
  const { tipo, punto_id } = documentoSchema.parse(req.body ?? {});
  if (!req.file) throw badRequest('Debe adjuntar el archivo firmado.');

  const [eventos] = await db.query('SELECT id FROM eventos WHERE id = ?', [id]);
  if (!eventos.length) throw notFound('Evento no encontrado.');

  let urlAnterior;
  if (punto_id) {
    const [puntos] = await db.query('SELECT acta_firmada_url FROM puntos_asamblea WHERE id = ? AND evento_id = ?', [punto_id, id]);
    if (!puntos.length) throw notFound('El punto del acta no pertenece a este evento.');
    urlAnterior = puntos[0].acta_firmada_url;
  } else {
    const [existente] = await db.query('SELECT ruta_archivo_firmado FROM documentos_evento WHERE evento_id = ? AND tipo = ?', [id, tipo]);
    urlAnterior = existente[0]?.ruta_archivo_firmado ?? null;
  }

  const { url, mime } = await guardarDocumento(req.file.buffer, punto_id ? 'acta_punto' : tipo.toLowerCase());
  const nombre = nombreVisible(req.file.originalname, `${tipo}_firmado`);

  if (punto_id) {
    await db.query(
      `UPDATE puntos_asamblea
       SET acta_firmada_url = ?, acta_firmada_nombre = ?, estado_acta = 'FIRMADA', fecha_acta = UTC_TIMESTAMP()
       WHERE id = ?`,
      [url, nombre, punto_id]
    );
  } else {
    await db.query(
      `INSERT INTO documentos_evento
         (evento_id, tipo, estado, nombre_archivo, ruta_archivo_firmado, nombre_archivo_firmado, mime_type, fecha_subida_firmado, subido_por_cuenta_id)
       VALUES (?, ?, 'FIRMADO', ?, ?, ?, ?, UTC_TIMESTAMP(), ?)
       ON DUPLICATE KEY UPDATE estado = 'FIRMADO', nombre_archivo = VALUES(nombre_archivo),
         ruta_archivo_firmado = VALUES(ruta_archivo_firmado), nombre_archivo_firmado = VALUES(nombre_archivo_firmado),
         mime_type = VALUES(mime_type), fecha_subida_firmado = VALUES(fecha_subida_firmado),
         subido_por_cuenta_id = VALUES(subido_por_cuenta_id)`,
      [id, tipo, nombre, url, nombre, mime, req.user.cuentaId]
    );
  }
  await eliminarDocumento(urlAnterior);

  await registrarAuditoria({
    cuentaId: req.user.cuentaId, accion: 'CREAR', entidad: punto_id ? 'puntos_asamblea' : 'documentos_evento',
    entidadId: punto_id || id, ip: req.ip, detalle: { eventoId: id, tipo, url }
  });

  return res.json({ status: 'OK', message: 'Documento firmado guardado correctamente.', url, nombre_archivo: nombre, punto_id: punto_id ?? null });
}

/**
 * Generar y descargar documento PDF con todas las personas registradas para firma de asistencia
 */
async function descargarPDFAsistencia(req, res, next) {
  try {
    const { id } = req.params;
    const [eventos] = await db.query(`SELECT * FROM eventos WHERE id = ?`, [id]);
    if (eventos.length === 0) {
      return res.status(404).json({ status: 'ERROR', message: 'Evento no encontrado.' });
    }
    const evento = eventos[0];

    const doc = new PDFDocument({ margin: 40, size: 'A4' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Lista_Asistencia_${evento.tipo}_${id}.pdf"`);

    doc.pipe(res);

    // Titulo de la Junta
    doc.fillColor('#0284c7').fontSize(16).text('JUNTA DE AGUA Y RIEGO LA JONES (PATATE)', { align: 'center' });
    doc.fillColor('#333333').fontSize(12).text(`HOJA DE ASISTENCIA PARA REGISTRO Y FIRMAS - ${evento.tipo}`, { align: 'center' });
    doc.moveDown(0.5);

    // Metadata del Evento
    const fechaFormatted = new Date(evento.fecha).toLocaleDateString('es-EC');
    doc.fontSize(10).fillColor('#000000');
    doc.text(`Evento: ${evento.titulo}`);
    doc.text(`Fecha: ${fechaFormatted} | Hora: ${evento.hora_inicio || '08:00'}`);
    doc.text(`Lugar: ${evento.lugar || 'Casa Comunal Junta La Jones'}`);
    if (evento.genera_multa_ausencia) {
      doc.text(`Multa por Inasistencia: $${Number(evento.valor_multa).toFixed(2)}`);
    }
    doc.moveDown(0.8);

    const [personas] = await db.query(
      `SELECT cedula, nombres, apellidos FROM personas WHERE estado = 'ACTIVO' ORDER BY apellidos ASC, nombres ASC`
    );

    // Encabezado de la Tabla
    let y = doc.y;
    doc.rect(40, y, 515, 20).fill('#e2e8f0');
    doc.fillColor('#0f172a').fontSize(9);
    doc.text('Nº', 45, y + 5, { width: 30 });
    doc.text('Cédula', 80, y + 5, { width: 80 });
    doc.text('Apellidos y Nombres (Comunero)', 165, y + 5, { width: 220 });
    doc.text('Firma / Huella Evidencia', 390, y + 5, { width: 150 });
    
    y += 22;

    personas.forEach((p, index) => {
      if (y > 750) {
        doc.addPage();
        y = 40;
        // Repetir encabezado en nueva página
        doc.rect(40, y, 515, 20).fill('#e2e8f0');
        doc.fillColor('#0f172a').fontSize(9);
        doc.text('Nº', 45, y + 5, { width: 30 });
        doc.text('Cédula', 80, y + 5, { width: 80 });
        doc.text('Apellidos y Nombres (Comunero)', 165, y + 5, { width: 220 });
        doc.text('Firma / Huella Evidencia', 390, y + 5, { width: 150 });
        y += 22;
      }

      doc.fillColor('#333333').fontSize(9);
      doc.text((index + 1).toString(), 45, y + 4, { width: 30 });
      doc.text(p.cedula, 80, y + 4, { width: 80 });
      doc.text(`${p.apellidos} ${p.nombres}`, 165, y + 4, { width: 220 });
      
      // Línea de firma
      doc.moveTo(390, y + 16).lineTo(540, y + 16).stroke('#cbd5e1');

      // Línea divisoria de fila
      doc.moveTo(40, y + 20).lineTo(555, y + 20).stroke('#f1f5f9');
      y += 22;
    });

    doc.end();
  } catch (error) {
    next(error);
  }
}

/** Documentos registrados de un evento (sin el contenido). */
async function getDocumentosEvento(req, res) {
  const { id } = idParam.parse(req.params);
  const [documentos] = await db.query(
    `SELECT id, tipo, estado, nombre_archivo, ruta_archivo_firmado, mime_type, fecha_subida_firmado, updated_at
     FROM documentos_evento WHERE evento_id = ? ORDER BY tipo`,
    [id]
  );
  return res.json({ status: 'OK', data: documentos });
}

module.exports = {
  getEventos,
  getEventosPublicos,
  getEventoById,
  createEvento,
  savePuntosAsamblea,
  cambiarEstado,
  cambiarEstadoActaPunto,
  registrarAsistencias,
  getAsistencias,
  finalizarEventoYGenerarMultas,
  guardarDocumentoEvento,
  getDocumentosEvento,
  descargarPDFAsistencia
};

