const db = require('../config/db');
const PDFDocument = require('pdfkit');
const { registrarAuditoria } = require('../services/auditService');
const { guardarDocumento, eliminarDocumento } = require('../services/documentStorage');
const eventos = require('../services/eventosService');
const { withTransaction } = require('../shared/transaction');
const { badRequest, notFound, conflict } = require('../shared/errors');
const { hoy } = require('../shared/dates');
const { z, idParam, fecha, hora, textoOpcional, dinero } = require('../shared/schemas');

const TIPOS = ['ASAMBLEA', 'MINGA'];
const ESTADOS = ['BORRADOR', 'PROGRAMADO', 'CONVOCADO', 'REALIZADO', 'CANCELADO'];

const listarSchema = z.object({
  tipo: z.enum(TIPOS).optional(),
  estado: z.enum(ESTADOS).optional(),
  desde: fecha.optional(),
  hasta: fecha.optional()
});

const crearSchema = z.object({
  tipo: z.enum(TIPOS, { error: 'El tipo debe ser ASAMBLEA o MINGA.' }),
  titulo: z.string().trim().min(3, 'El título debe tener al menos 3 caracteres.').max(200),
  descripcion: textoOpcional(2000),
  fecha,
  hora_inicio: hora,
  hora_fin: z.preprocess((v) => (v === '' ? null : v), hora.nullish()).transform((v) => v ?? null),
  lugar: textoOpcional(255),
  requiere_asistencia: z.boolean().default(true),
  genera_multa_ausencia: z.boolean().default(true),
  valor_multa: z.preprocess((v) => (v === '' ? null : v), dinero.min(0).max(1000).nullish()),
  puntos_orden_dia: z.array(z.union([
    z.string(),
    z.object({ punto_tratar: z.string(), tratado: z.string().nullish(), resolucion: z.string().nullish() })
  ])).max(50).default([])
}).superRefine((d, ctx) => {
  if (d.hora_fin && d.hora_fin <= d.hora_inicio) {
    ctx.addIssue({ code: 'custom', path: ['hora_fin'], message: 'La hora de fin debe ser posterior a la de inicio.' });
  }
  if (d.genera_multa_ausencia && d.valor_multa !== null && d.valor_multa !== undefined && d.valor_multa <= 0) {
    ctx.addIssue({ code: 'custom', path: ['valor_multa'], message: 'La multa debe ser mayor a cero o desactive la multa por ausencia.' });
  }
});

const puntoSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  orden: z.coerce.number().int().min(1).max(200).optional(),
  punto_tratar: z.string().trim().max(5000).optional(),
  titulo_acta: z.string().trim().max(255).nullish(),
  tratado: z.string().max(20000).nullish(),
  resolucion: z.string().max(20000).nullish(),
  responsables: z.string().trim().max(255).nullish(),
  estado_acta: z.enum(['BORRADOR', 'APROBADA', 'FIRMADA']).optional(),
  fecha_acta: z.string().nullish()
});
const puntosSchema = z.object({ puntos: z.array(puntoSchema).max(100) });

const actaPuntoSchema = z.object({
  estado_acta: z.enum(['BORRADOR', 'APROBADA', 'FIRMADA']).optional(),
  resolucion: z.string().max(20000).nullish(),
  tratado: z.string().max(20000).nullish(),
  responsables: z.string().trim().max(255).nullish(),
  titulo_acta: z.string().trim().max(255).nullish()
});

const COLUMNAS_DOCUMENTOS = `
  (SELECT d.ruta_archivo_firmado FROM documentos_evento d WHERE d.evento_id = e.id AND d.tipo = 'CONVOCATORIA' LIMIT 1) AS convocatoria_firmada_url,
  (SELECT d.nombre_archivo FROM documentos_evento d WHERE d.evento_id = e.id AND d.tipo = 'CONVOCATORIA' LIMIT 1) AS convocatoria_firmada_nombre,
  (SELECT d.ruta_archivo_firmado FROM documentos_evento d WHERE d.evento_id = e.id AND d.tipo = 'ACTA' LIMIT 1) AS acta_firmada_url,
  (SELECT d.nombre_archivo FROM documentos_evento d WHERE d.evento_id = e.id AND d.tipo = 'ACTA' LIMIT 1) AS acta_firmada_nombre,
  (SELECT d.ruta_archivo_firmado FROM documentos_evento d WHERE d.evento_id = e.id AND d.tipo = 'OTRO' LIMIT 1) AS lista_asistencia_firmada_url`;

/** Listar asambleas y mingas con sus métricas de asistencia y documentos. */
async function getEventos(req, res) {
  const { tipo, estado, desde, hasta } = listarSchema.parse(req.query);
  const filtros = [];
  const params = [];
  if (tipo) { filtros.push('e.tipo = ?'); params.push(tipo); }
  if (estado) { filtros.push('e.estado = ?'); params.push(estado); }
  if (desde) { filtros.push('e.fecha >= ?'); params.push(desde); }
  if (hasta) { filtros.push('e.fecha <= ?'); params.push(hasta); }

  const [[{ totalComuneros }]] = await db.query("SELECT COUNT(*) AS totalComuneros FROM personas WHERE estado = 'ACTIVO'");
  const [filas] = await db.query(
    `SELECT e.id, e.tipo, e.titulo, e.descripcion, e.fecha, e.hora_inicio, e.hora_fin, e.lugar, e.estado,
            e.requiere_asistencia, e.genera_multa_ausencia, e.valor_multa, e.created_by_cuenta_id, e.created_at,
            CONCAT(p.nombres, ' ', p.apellidos) AS creado_por_usuario,
            COALESCE(a.presentes, 0) AS asistentes, COALESCE(a.registrados, 0) AS registrados,
            COALESCE(m.multas, 0) AS multas_generadas,
            ${COLUMNAS_DOCUMENTOS}
     FROM eventos e
     LEFT JOIN cuentas c ON c.id = e.created_by_cuenta_id
     LEFT JOIN personas p ON p.id = c.persona_id
     LEFT JOIN (SELECT evento_id, SUM(estado = 'PRESENTE') AS presentes, COUNT(*) AS registrados
                FROM asistencias GROUP BY evento_id) a ON a.evento_id = e.id
     LEFT JOIN (SELECT evento_id, COUNT(*) AS multas FROM obligaciones
                WHERE evento_id IS NOT NULL AND estado <> 'ANULADA' GROUP BY evento_id) m ON m.evento_id = e.id
     ${filtros.length ? `WHERE ${filtros.join(' AND ')}` : ''}
     ORDER BY e.fecha DESC, e.hora_inicio DESC`,
    params
  );

  // Eventos cerrados reportan su padrón real; los abiertos, los comuneros activos actuales.
  const data = filas.map((e) => ({
    ...e,
    asistentes: Number(e.asistentes),
    registrados: Number(e.registrados),
    multas_generadas: Number(e.multas_generadas),
    totalComuneros: ['REALIZADO', 'CANCELADO'].includes(e.estado) && Number(e.registrados) ? Number(e.registrados) : totalComuneros
  }));
  return res.json({ status: 'OK', data });
}

/** Próximos eventos anunciados, sin datos personales (portal público). */
async function getEventosPublicos(req, res) {
  const limite = Math.min(Math.max(Number.parseInt(req.query.limite, 10) || 20, 1), 50);
  // La convocatoria firmada es un documento público dirigido a todos los comuneros.
  const [filas] = await db.query(
    `SELECT e.id, e.tipo, e.titulo, e.descripcion, e.fecha, e.hora_inicio, e.hora_fin, e.lugar, e.estado,
            e.genera_multa_ausencia, e.valor_multa,
            (SELECT d.ruta_archivo_firmado FROM documentos_evento d
              WHERE d.evento_id = e.id AND d.tipo = 'CONVOCATORIA' AND d.ruta_archivo_firmado IS NOT NULL LIMIT 1) AS convocatoria_firmada_url
     FROM eventos e
     WHERE e.estado IN ('PROGRAMADO', 'CONVOCADO') AND e.fecha >= ?
     ORDER BY e.fecha ASC, e.hora_inicio ASC
     LIMIT ?`,
    [hoy(), limite]
  );
  return res.json({ status: 'OK', data: filas, eventos: filas });
}

/** Detalle de un evento con sus puntos (actas) y el resumen de asistencia. */
async function getEventoById(req, res) {
  const { id } = idParam.parse(req.params);
  const [filas] = await db.query(`SELECT e.*, ${COLUMNAS_DOCUMENTOS} FROM eventos e WHERE e.id = ?`, [id]);
  if (!filas.length) throw notFound('Evento no encontrado.');

  const [puntos] = await db.query('SELECT * FROM puntos_asamblea WHERE evento_id = ? ORDER BY orden ASC', [id]);
  const [asistenciaStats] = await db.query(
    'SELECT estado, COUNT(*) AS total FROM asistencias WHERE evento_id = ? GROUP BY estado', [id]
  );
  return res.json({ status: 'OK', evento: filas[0], puntos, asistenciaStats });
}

/** Crear asamblea o minga (con sus puntos del orden del día, en una sola transacción). */
async function createEvento(req, res) {
  const datos = crearSchema.parse(req.body);
  if (datos.tipo === 'ASAMBLEA' && datos.fecha < hoy()) {
    throw badRequest('La fecha de la asamblea no puede ser anterior a la fecha actual.');
  }
  const valorMulta = datos.genera_multa_ausencia ? (datos.valor_multa ?? 10) : null;
  const puntos = datos.tipo === 'ASAMBLEA'
    ? datos.puntos_orden_dia
      .map((p) => (typeof p === 'string' ? { punto_tratar: p } : p))
      .map((p) => ({ ...p, punto_tratar: p.punto_tratar.trim() }))
      .filter((p) => p.punto_tratar)
    : [];

  const eventoId = await withTransaction(async (conexion) => {
    const [r] = await conexion.query(
      `INSERT INTO eventos (tipo, titulo, descripcion, fecha, hora_inicio, hora_fin, lugar, requiere_asistencia,
                            genera_multa_ausencia, valor_multa, created_by_cuenta_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [datos.tipo, datos.titulo, datos.descripcion, datos.fecha, datos.hora_inicio, datos.hora_fin,
        datos.lugar || 'Casa Comunal Junta La Jones', datos.requiere_asistencia, datos.genera_multa_ausencia, valorMulta,
        req.user.cuentaId]
    );
    if (puntos.length) {
      await conexion.query(
        'INSERT INTO puntos_asamblea (evento_id, orden, punto_tratar, tratado, resolucion, titulo_acta) VALUES ?',
        [puntos.map((p, i) => [r.insertId, i + 1, p.punto_tratar, p.tratado || null, p.resolucion || null, p.punto_tratar.slice(0, 255)])]
      );
    }
    return r.insertId;
  });

  await registrarAuditoria({
    cuentaId: req.user.cuentaId, accion: 'CREAR', entidad: 'eventos', entidadId: eventoId, ip: req.ip,
    detalle: { tipo: datos.tipo, titulo: datos.titulo, fecha: datos.fecha, valorMulta, puntos: puntos.length }
  });
  return res.status(201).json({ status: 'OK', message: 'Evento registrado exitosamente.', eventoId });
}

/**
 * Guardar los puntos del orden del día y sus actas. Actualiza los existentes por id,
 * crea los nuevos y elimina los que ya no se envían (con su archivo firmado, si lo había).
 */
async function savePuntosAsamblea(req, res) {
  const { id } = idParam.parse(req.params);
  const { puntos } = puntosSchema.parse(req.body);

  const { data, archivosEliminados } = await withTransaction(async (conexion) => {
    const evento = await eventos.obtenerEvento(conexion, id, { tipo: 'ASAMBLEA' });
    if (evento.estado === 'CANCELADO') throw conflict('La asamblea está cancelada.');

    const [existentes] = await conexion.query('SELECT * FROM puntos_asamblea WHERE evento_id = ? FOR UPDATE', [id]);
    const porId = new Map(existentes.map((p) => [p.id, p]));
    const validos = puntos
      .map((p) => ({ ...p, texto: (p.punto_tratar || p.titulo_acta || '').trim() }))
      .filter((p) => p.texto)
      .map((p, i) => ({ ...p, orden: i + 1 }));
    if (validos.some((p) => p.id && !porId.has(p.id))) throw badRequest('Uno de los puntos no pertenece a esta asamblea.');

    const conservados = new Set(validos.filter((p) => p.id).map((p) => p.id));
    const eliminados = existentes.filter((p) => !conservados.has(p.id));
    if (eliminados.length) {
      await conexion.query('DELETE FROM puntos_asamblea WHERE id IN (?)', [eliminados.map((p) => p.id)]);
    }
    // Liberar los números de orden antes de reasignarlos (clave única evento + orden).
    await conexion.query('UPDATE puntos_asamblea SET orden = -orden - 1000 WHERE evento_id = ?', [id]);

    for (const p of validos) {
      const previo = p.id ? porId.get(p.id) : null;
      const valores = {
        orden: p.orden,
        punto_tratar: p.texto,
        titulo_acta: (p.titulo_acta || p.texto).slice(0, 255),
        tratado: p.tratado !== undefined ? p.tratado : previo?.tratado ?? null,
        resolucion: p.resolucion !== undefined ? p.resolucion : previo?.resolucion ?? null,
        responsables: p.responsables !== undefined ? p.responsables : previo?.responsables ?? null,
        estado_acta: p.estado_acta || previo?.estado_acta || 'BORRADOR'
      };
      if (previo) {
        await conexion.query('UPDATE puntos_asamblea SET ? WHERE id = ?', [valores, previo.id]);
      } else {
        await conexion.query('INSERT INTO puntos_asamblea SET ?', [{ ...valores, evento_id: id }]);
      }
    }

    const [actualizados] = await conexion.query('SELECT * FROM puntos_asamblea WHERE evento_id = ? ORDER BY orden ASC', [id]);
    return { data: actualizados, archivosEliminados: eliminados.map((p) => p.acta_firmada_url).filter(Boolean) };
  });

  for (const url of archivosEliminados) await eliminarDocumento(url);
  await registrarAuditoria({ cuentaId: req.user.cuentaId, accion: 'MODIFICAR', entidad: 'puntos_asamblea', entidadId: id, ip: req.ip, detalle: { puntos: data.length } });
  return res.json({ status: 'OK', message: 'Puntos del orden del día y actas guardados correctamente.', data, puntos: data });
}

/** Cambiar estado (PROGRAMADO, CONVOCADO, CANCELADO) de una asamblea o minga. */
async function cambiarEstado(req, res) {
  const { id } = idParam.parse(req.params);
  const estado = req.body?.estado;
  const resultado = await withTransaction(async (conexion) => {
    const evento = await eventos.obtenerEvento(conexion, id);
    return eventos.cambiarEstado(conexion, evento, estado);
  });
  if (resultado.cambiado) {
    await registrarAuditoria({
      cuentaId: req.user.cuentaId, accion: 'MODIFICAR', entidad: 'eventos', entidadId: id, ip: req.ip,
      detalle: { estadoAnterior: resultado.estadoAnterior, nuevoEstado: estado }
    });
  }
  return res.json({
    status: 'OK',
    message: resultado.cambiado ? `Estado actualizado a ${estado}.` : 'El evento ya tiene ese estado.',
    estado
  });
}

/** Actualizar los datos del acta de un punto específico. */
async function cambiarEstadoActaPunto(req, res) {
  const { id } = idParam.parse(req.params);
  const puntoId = z.coerce.number().int().positive().parse(req.params.puntoId);
  const cambios = Object.fromEntries(Object.entries(actaPuntoSchema.parse(req.body)).filter(([, v]) => v !== undefined));
  if (!Object.keys(cambios).length) throw badRequest('No se enviaron cambios para el acta.');

  const [r] = await db.query('UPDATE puntos_asamblea SET ? WHERE id = ? AND evento_id = ?', [cambios, puntoId, id]);
  if (!r.affectedRows) throw notFound('Punto de asamblea no encontrado.');
  const [[actualizado]] = await db.query('SELECT * FROM puntos_asamblea WHERE id = ?', [puntoId]);
  return res.json({ status: 'OK', message: 'Acta del punto actualizada exitosamente.', data: actualizado });
}

/** Padrón de asistencia del evento (comuneros con su estado) y resumen. */
async function getAsistencias(req, res) {
  const { id } = idParam.parse(req.params);
  const { evento, padron } = await withTransaction(async (conexion) => {
    const ev = await eventos.obtenerEvento(conexion, id);
    return { evento: ev, padron: await eventos.obtenerPadron(conexion, ev) };
  });
  return res.json({ status: 'OK', data: padron.personas, resumen: padron.resumen, estado: evento.estado });
}

/** Registrar o corregir la asistencia de los comuneros mientras el evento está abierto. */
async function registrarAsistencias(req, res) {
  const { id } = idParam.parse(req.params);
  const { registradas } = await withTransaction(async (conexion) => {
    const evento = await eventos.obtenerEvento(conexion, id);
    return eventos.registrarAsistencias(conexion, evento, req.body?.asistencias, req.user.cuentaId);
  });
  await registrarAuditoria({ cuentaId: req.user.cuentaId, accion: 'MODIFICAR', entidad: 'asistencias', entidadId: id, ip: req.ip, detalle: { registradas } });
  return res.json({ status: 'OK', message: 'Asistencias registradas exitosamente.', registradas });
}

/** Finalizar el evento y generar las multas por ausencia. */
async function finalizarEventoYGenerarMultas(req, res) {
  const { id } = idParam.parse(req.params);
  const resultado = await withTransaction(async (conexion) => {
    const evento = await eventos.obtenerEvento(conexion, id);
    return eventos.finalizar(conexion, evento);
  });
  if (!resultado.yaFinalizada) {
    await registrarAuditoria({
      cuentaId: req.user.cuentaId, accion: 'MODIFICAR', entidad: 'eventos', entidadId: id, ip: req.ip,
      detalle: { finalizarEvento: true, multasGeneradas: resultado.multasGeneradas }
    });
  }
  return res.json({
    status: 'OK',
    message: resultado.yaFinalizada
      ? 'El evento ya fue finalizado. No se generaron nuevas multas.'
      : `Evento finalizado exitosamente. Se generaron ${resultado.multasGeneradas} multas por inasistencia.`,
    estado: 'REALIZADO',
    multasGeneradas: resultado.multasGeneradas,
    yaFinalizada: resultado.yaFinalizada
  });
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

const fechaLegible = (iso) => {
  const [a, m, d] = String(iso).slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
};

/** Hoja de asistencia en PDF con el padrón del evento, para firmas. */
async function descargarPDFAsistencia(req, res) {
  const { id } = idParam.parse(req.params);
  const { evento, padron } = await withTransaction(async (conexion) => {
    const ev = await eventos.obtenerEvento(conexion, id);
    return { evento: ev, padron: await eventos.obtenerPadron(conexion, ev) };
  });

  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="Lista_Asistencia_${evento.tipo}_${evento.id}.pdf"`);
  res.setHeader('Cache-Control', 'private, no-store');
  doc.pipe(res);

  doc.fillColor('#0284c7').fontSize(16).text('JUNTA DE AGUA Y RIEGO LA JONES (PATATE)', { align: 'center' });
  doc.fillColor('#333333').fontSize(12).text(`HOJA DE ASISTENCIA PARA REGISTRO Y FIRMAS - ${evento.tipo}`, { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(10).fillColor('#000000');
  doc.text(`Evento: ${evento.titulo}`);
  doc.text(`Fecha: ${fechaLegible(evento.fecha)} | Hora: ${String(evento.hora_inicio || '08:00').slice(0, 5)}`);
  doc.text(`Lugar: ${evento.lugar || 'Casa Comunal Junta La Jones'}`);
  if (evento.genera_multa_ausencia) doc.text(`Multa por inasistencia: $${Number(evento.valor_multa).toFixed(2)}`);
  doc.moveDown(0.8);

  const encabezado = (y) => {
    doc.rect(40, y, 515, 20).fill('#e2e8f0');
    doc.fillColor('#0f172a').fontSize(9);
    doc.text('Nº', 45, y + 5, { width: 30 });
    doc.text('Cédula', 80, y + 5, { width: 80 });
    doc.text('Apellidos y Nombres (Comunero)', 165, y + 5, { width: 220 });
    doc.text('Firma / Huella', 390, y + 5, { width: 150 });
    return y + 22;
  };

  let y = encabezado(doc.y);
  padron.personas.forEach((p, i) => {
    if (y > 750) {
      doc.addPage();
      y = encabezado(40);
    }
    doc.fillColor('#333333').fontSize(9);
    doc.text(String(i + 1), 45, y + 4, { width: 30 });
    doc.text(p.cedula, 80, y + 4, { width: 80 });
    doc.text(p.nombre, 165, y + 4, { width: 220 });
    doc.moveTo(390, y + 16).lineTo(540, y + 16).stroke('#cbd5e1');
    doc.moveTo(40, y + 20).lineTo(555, y + 20).stroke('#f1f5f9');
    y += 22;
  });
  doc.end();
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
