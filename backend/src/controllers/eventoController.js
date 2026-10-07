/**
 * Rutas de asambleas y mingas. Los controladores validan la entrada, delegan en los servicios
 * (eventosService, documentosEventoService, listaAsistenciaPdf), registran la auditoría y responden.
 */
const db = require('../config/db');
const { registrarAuditoria } = require('../services/auditService');
const { eliminarDocumento } = require('../services/documentStorage');
const eventos = require('../services/eventosService');
const documentos = require('../services/documentosEventoService');
const { escribirListaAsistencia } = require('../services/listaAsistenciaPdf');
const { withTransaction } = require('../shared/transaction');
const { badRequest } = require('../shared/errors');
const { idParam } = require('../shared/schemas');
const {
  listarSchema, crearSchema, puntosSchema, actaPuntoSchema, documentoSchema, puntoParam
} = require('../schemas/eventos');

/** Listar asambleas y mingas con sus métricas de asistencia y documentos. */
async function getEventos(req, res) {
  const data = await eventos.listarEventos(db, listarSchema.parse(req.query));
  return res.json({ status: 'OK', data });
}

/** Próximos eventos anunciados, sin datos personales (portal público). */
async function getEventosPublicos(req, res) {
  const limite = Math.min(Math.max(Number.parseInt(req.query.limite, 10) || 20, 1), 50);
  const filas = await eventos.listarEventosPublicos(db, limite);
  return res.json({ status: 'OK', data: filas, eventos: filas });
}

/** Detalle de un evento con sus puntos (actas) y el resumen de asistencia. */
async function getEventoById(req, res) {
  const { id } = idParam.parse(req.params);
  const { evento, puntos, asistenciaStats } = await eventos.detalleEvento(db, id);
  return res.json({ status: 'OK', evento, puntos, asistenciaStats });
}

/** Crear asamblea o minga (con sus puntos del orden del día, en una sola transacción). */
async function createEvento(req, res) {
  const datos = crearSchema.parse(req.body);
  const { eventoId, valorMulta, puntos } = await withTransaction((conexion) => eventos.crearEvento(conexion, datos, req.user.cuentaId));
  await registrarAuditoria({
    cuentaId: req.user.cuentaId, accion: 'CREAR', entidad: 'eventos', entidadId: eventoId, ip: req.ip,
    detalle: { tipo: datos.tipo, titulo: datos.titulo, fecha: datos.fecha, valorMulta, puntos }
  });
  return res.status(201).json({ status: 'OK', message: 'Evento registrado exitosamente.', eventoId });
}

/** Guardar los puntos del orden del día y sus actas; borra los archivos de los puntos eliminados. */
async function savePuntosAsamblea(req, res) {
  const { id } = idParam.parse(req.params);
  const { puntos } = puntosSchema.parse(req.body);
  const { data, archivosEliminados } = await withTransaction((conexion) => eventos.guardarPuntos(conexion, id, puntos));
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
  const { id, puntoId } = puntoParam.parse(req.params);
  const cambios = Object.fromEntries(Object.entries(actaPuntoSchema.parse(req.body)).filter(([, v]) => v !== undefined));
  const actualizado = await withTransaction((conexion) => eventos.actualizarActaPunto(conexion, id, puntoId, cambios));
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

/**
 * Guardar el documento firmado (PDF o imagen escaneada) de un evento o del acta de un punto.
 * Recibe multipart/form-data con el campo "archivo". El tipo real del archivo se valida por su contenido.
 */
async function guardarDocumentoEvento(req, res) {
  const { id } = idParam.parse(req.params);
  const { tipo, punto_id } = documentoSchema.parse(req.body ?? {});
  if (!req.file) throw badRequest('Debe adjuntar el archivo firmado.');

  const { url, nombre } = await documentos.guardarDocumentoFirmado({
    eventoId: id, tipo, puntoId: punto_id ?? null, archivo: req.file, cuentaId: req.user.cuentaId
  });
  await registrarAuditoria({
    cuentaId: req.user.cuentaId, accion: 'CREAR', entidad: punto_id ? 'puntos_asamblea' : 'documentos_evento',
    entidadId: punto_id || id, ip: req.ip, detalle: { eventoId: id, tipo, url }
  });
  return res.json({ status: 'OK', message: 'Documento firmado guardado correctamente.', url, nombre_archivo: nombre, punto_id: punto_id ?? null });
}

/** Hoja de asistencia en PDF con el padrón del evento, para firmas. */
async function descargarPDFAsistencia(req, res) {
  const { id } = idParam.parse(req.params);
  const { evento, padron } = await withTransaction(async (conexion) => {
    const ev = await eventos.obtenerEvento(conexion, id);
    return { evento: ev, padron: await eventos.obtenerPadron(conexion, ev) };
  });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="Lista_Asistencia_${evento.tipo}_${evento.id}.pdf"`);
  res.setHeader('Cache-Control', 'private, no-store');
  escribirListaAsistencia(res, evento, padron.personas);
}

/** Documentos registrados de un evento (sin el contenido). */
async function getDocumentosEvento(req, res) {
  const { id } = idParam.parse(req.params);
  return res.json({ status: 'OK', data: await documentos.listarDocumentos(id) });
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
