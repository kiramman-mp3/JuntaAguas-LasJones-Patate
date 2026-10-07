/**
 * Reglas de negocio comunes a asambleas y mingas: estados, padrón de asistencia,
 * registro de asistencias y finalización con generación de multas.
 * Todas las funciones reciben una conexión dentro de una transacción.
 */
const { badRequest, notFound, conflict } = require('../shared/errors');
const { hoy, yaOcurrio } = require('../shared/dates');
const { conceptoPorCodigo, tarifaVigente } = require('./finanzasService');

const ESTADOS_ABIERTOS = ['BORRADOR', 'PROGRAMADO', 'CONVOCADO'];
const ESTADOS_ASISTENCIA = ['PENDIENTE', 'PRESENTE', 'AUSENTE', 'JUSTIFICADO'];
const CONCEPTO_MULTA = { ASAMBLEA: 'MULTA_ASAMBLEA', MINGA: 'MULTA_MINGA' };
const NOMBRE = { ASAMBLEA: 'asamblea', MINGA: 'minga' };

// Transiciones permitidas. Para pasar a REALIZADO se usa finalizar().
const TRANSICIONES = {
  BORRADOR: ['PROGRAMADO', 'CONVOCADO', 'CANCELADO'],
  PROGRAMADO: ['CONVOCADO', 'CANCELADO'],
  CONVOCADO: ['CANCELADO'],
  REALIZADO: [],
  CANCELADO: []
};

/** Carga y bloquea el evento. Si se indica `tipo`, exige que coincida. */
async function obtenerEvento(conexion, id, { tipo } = {}) {
  if (!Number.isSafeInteger(Number(id)) || Number(id) <= 0) throw badRequest('El identificador del evento no es válido.');
  const [filas] = await conexion.query('SELECT * FROM eventos WHERE id = ? FOR UPDATE', [id]);
  if (!filas.length) throw notFound(tipo === 'MINGA' ? 'Minga no encontrada.' : 'Evento no encontrado.');
  const evento = filas[0];
  if (tipo && evento.tipo !== tipo) {
    throw badRequest(tipo === 'MINGA' ? 'Esta operación corresponde exclusivamente a Mingas.' : 'Esta operación corresponde exclusivamente a Asambleas.');
  }
  return evento;
}

function exigirAbierto(evento) {
  if (!ESTADOS_ABIERTOS.includes(evento.estado)) {
    throw conflict(`La ${NOMBRE[evento.tipo]} ya está realizada o cancelada; su registro de asistencia está cerrado.`);
  }
}

/**
 * Padrón de asistencia: comuneros activos más quien ya tenga un registro en el evento
 * (por si fue desactivado después). Incluye el resumen por estado.
 */
async function obtenerPadron(conexion, evento) {
  const [personas] = await conexion.query(
    `SELECT p.id AS persona_id, CONCAT(p.apellidos, ' ', p.nombres) AS nombre, p.cedula,
            COALESCE(a.estado, 'PENDIENTE') AS estado, COALESCE(a.motivo_justificacion, '') AS motivo_justificacion,
            a.hora_registro
     FROM personas p
     LEFT JOIN asistencias a ON a.persona_id = p.id AND a.evento_id = ?
     WHERE p.estado = 'ACTIVO' OR a.id IS NOT NULL
     ORDER BY p.apellidos, p.nombres`,
    [evento.id]
  );
  const resumen = { total: personas.length, presentes: 0, ausentes: 0, justificados: 0, pendientes: 0 };
  for (const persona of personas) {
    if (persona.estado === 'PRESENTE') resumen.presentes++;
    else if (persona.estado === 'AUSENTE') resumen.ausentes++;
    else if (persona.estado === 'JUSTIFICADO' && persona.motivo_justificacion.trim()) resumen.justificados++;
    else resumen.pendientes++;
  }
  return { personas, resumen };
}

async function cambiarEstado(conexion, evento, estado, { cuentaId } = {}) {
  if (!['PROGRAMADO', 'CONVOCADO', 'CANCELADO'].includes(estado)) {
    throw badRequest(`Seleccione Programada, Convocada o Cancelada. Para realizarla, use Finalizar ${NOMBRE[evento.tipo]}.`);
  }
  if (evento.estado === estado) return { cambiado: false };
  if (!TRANSICIONES[evento.estado].includes(estado)) {
    const motivo = ['REALIZADO', 'CANCELADO'].includes(evento.estado)
      ? `La ${NOMBRE[evento.tipo]} ya está ${evento.estado === 'REALIZADO' ? 'realizada' : 'cancelada'} y no puede cambiar de estado.`
      : `No se permite retroceder el estado de la ${NOMBRE[evento.tipo]}.`;
    throw conflict(motivo);
  }
  await conexion.query('UPDATE eventos SET estado = ? WHERE id = ?', [estado, evento.id]);
  return { cambiado: true, estadoAnterior: evento.estado, cuentaId };
}

/** Valida y guarda (upsert) una lista de asistencias del evento. */
async function registrarAsistencias(conexion, evento, asistencias, cuentaId) {
  exigirAbierto(evento);
  if (!Array.isArray(asistencias) || !asistencias.length) throw badRequest('Se requiere una lista de asistencias.');
  if (asistencias.length > 5000) throw badRequest('La lista de asistencias es demasiado grande.');

  const ids = new Set();
  for (const a of asistencias) {
    const id = Number(a?.persona_id);
    if (!Number.isSafeInteger(id) || id <= 0 || ids.has(id) || !ESTADOS_ASISTENCIA.includes(a.estado)) {
      throw badRequest('La lista contiene personas repetidas o estados de asistencia inválidos.');
    }
    if (a.motivo_justificacion != null && (typeof a.motivo_justificacion !== 'string' || a.motivo_justificacion.length > 255)) {
      throw badRequest('El motivo no puede superar los 255 caracteres.');
    }
    if (a.estado === 'JUSTIFICADO' && !a.motivo_justificacion?.trim()) {
      throw badRequest('Se requiere un motivo para cada ausencia justificada.');
    }
    ids.add(id);
  }

  const { personas } = await obtenerPadron(conexion, evento);
  const permitidos = new Set(personas.map((p) => Number(p.persona_id)));
  if ([...ids].some((id) => !permitidos.has(id))) {
    throw badRequest(`La lista contiene personas que no pertenecen al padrón de esta ${NOMBRE[evento.tipo]}.`);
  }

  const ahora = new Date();
  const filas = asistencias.map((a) => [
    evento.id, Number(a.persona_id), a.estado, ahora, a.estado === 'JUSTIFICADO' ? a.motivo_justificacion.trim() : null, cuentaId
  ]);
  await conexion.query(
    `INSERT INTO asistencias (evento_id, persona_id, estado, hora_registro, motivo_justificacion, registrado_por_cuenta_id)
     VALUES ?
     ON DUPLICATE KEY UPDATE estado = VALUES(estado), hora_registro = VALUES(hora_registro),
       motivo_justificacion = VALUES(motivo_justificacion), registrado_por_cuenta_id = VALUES(registrado_por_cuenta_id)`,
    [filas]
  );
  return { registradas: filas.length };
}

/**
 * Finaliza el evento: exige que ya haya iniciado y que toda la asistencia esté registrada,
 * genera una multa por cada ausente (identificada por el evento, sin periodo mensual) y lo marca REALIZADO.
 * Es idempotente: finalizar de nuevo no genera multas adicionales.
 */
async function finalizar(conexion, evento, ahora = new Date()) {
  const nombre = NOMBRE[evento.tipo];
  if (evento.estado === 'REALIZADO') {
    return { yaFinalizada: true, multasGeneradas: 0 };
  }
  if (evento.estado === 'CANCELADO') throw conflict(`No se puede finalizar una ${nombre} cancelada.`);
  if (evento.estado === 'BORRADOR') throw conflict(`No se puede finalizar una ${nombre} en borrador. Primero debe programarse o convocarse.`);
  if (!yaOcurrio(evento.fecha, evento.hora_inicio, ahora)) {
    throw conflict(`Solo se puede finalizar una ${nombre} cuya fecha y hora de inicio ya hayan llegado (${evento.fecha} ${String(evento.hora_inicio).slice(0, 5)}). Si no se realizará, cancélela.`);
  }

  const { personas, resumen } = await obtenerPadron(conexion, evento);
  if (!resumen.total || resumen.pendientes) {
    throw conflict('Complete y guarde la asistencia de todos los comuneros antes de finalizar.', { resumen });
  }

  let multasGeneradas = 0;
  if (evento.genera_multa_ausencia) {
    const valor = Number(evento.valor_multa);
    if (!Number.isFinite(valor) || valor <= 0) throw conflict('Revise el valor de la multa antes de finalizar.');
    const codigo = CONCEPTO_MULTA[evento.tipo];
    const [conceptos] = await conexion.query('SELECT id FROM conceptos_cobro WHERE codigo = ? AND activo = TRUE', [codigo]);
    if (!conceptos.length) throw conflict(`El concepto ${codigo} no está configurado o está inactivo.`);
    const conceptoId = conceptos[0].id;

    const [yaRegistradas] = await conexion.query(
      'SELECT persona_id FROM obligaciones WHERE evento_id = ? AND concepto_id = ?', [evento.id, conceptoId]
    );
    const yaMultadas = new Set(yaRegistradas.map((o) => Number(o.persona_id)));
    const observacion = `Multa por ausencia a ${evento.tipo} (${evento.fecha}): ${evento.titulo}`.slice(0, 255);
    const emision = hoy(ahora);

    const filas = personas
      .filter((p) => p.estado === 'AUSENTE' && !yaMultadas.has(Number(p.persona_id)))
      .map((p) => [p.persona_id, conceptoId, evento.id, Number(evento.fecha.slice(0, 4)), null, emision, valor, 'AUTOMATICA', 'PENDIENTE', observacion]);

    if (filas.length) {
      // periodo_mes NULL: la multa se identifica por el evento, así dos eventos del mismo mes generan sus propias multas.
      await conexion.query(
        `INSERT INTO obligaciones (persona_id, concepto_id, evento_id, periodo_anio, periodo_mes, fecha_emision, valor, origen, estado, observacion)
         VALUES ?`,
        [filas]
      );
    }
    multasGeneradas = filas.length;
  }

  await conexion.query("UPDATE eventos SET estado = 'REALIZADO' WHERE id = ?", [evento.id]);
  return { yaFinalizada: false, multasGeneradas, resumen };
}

/* ------------------------------------------------------------------------------
 * Consultas y escritura de eventos (antes en eventoController).
 * ---------------------------------------------------------------------------- */

const COLUMNAS_DOCUMENTOS = `
  (SELECT d.ruta_archivo_firmado FROM documentos_evento d WHERE d.evento_id = e.id AND d.tipo = 'CONVOCATORIA' LIMIT 1) AS convocatoria_firmada_url,
  (SELECT d.nombre_archivo FROM documentos_evento d WHERE d.evento_id = e.id AND d.tipo = 'CONVOCATORIA' LIMIT 1) AS convocatoria_firmada_nombre,
  (SELECT d.ruta_archivo_firmado FROM documentos_evento d WHERE d.evento_id = e.id AND d.tipo = 'ACTA' LIMIT 1) AS acta_firmada_url,
  (SELECT d.nombre_archivo FROM documentos_evento d WHERE d.evento_id = e.id AND d.tipo = 'ACTA' LIMIT 1) AS acta_firmada_nombre,
  (SELECT d.ruta_archivo_firmado FROM documentos_evento d WHERE d.evento_id = e.id AND d.tipo = 'OTRO' LIMIT 1) AS lista_asistencia_firmada_url`;

/** Asambleas y mingas con métricas de asistencia, multas y documentos. */
async function listarEventos(conexion, { tipo, estado, desde, hasta }) {
  const filtros = [];
  const params = [];
  if (tipo) { filtros.push('e.tipo = ?'); params.push(tipo); }
  if (estado) { filtros.push('e.estado = ?'); params.push(estado); }
  if (desde) { filtros.push('e.fecha >= ?'); params.push(desde); }
  if (hasta) { filtros.push('e.fecha <= ?'); params.push(hasta); }

  const [[{ totalComuneros }]] = await conexion.query("SELECT COUNT(*) AS totalComuneros FROM personas WHERE estado = 'ACTIVO'");
  const [filas] = await conexion.query(
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
  return data;
}

/** Próximos eventos anunciados, sin datos personales. */
async function listarEventosPublicos(conexion, limite) {
  const [filas] = await conexion.query(
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
  return filas;
}

/** Detalle de un evento con sus puntos y el resumen de asistencia por estado. */
async function detalleEvento(conexion, id) {
  const [filas] = await conexion.query(`SELECT e.*, ${COLUMNAS_DOCUMENTOS} FROM eventos e WHERE e.id = ?`, [id]);
  if (!filas.length) throw notFound('Evento no encontrado.');
  const [puntos] = await conexion.query('SELECT * FROM puntos_asamblea WHERE evento_id = ? ORDER BY orden ASC', [id]);
  const [asistenciaStats] = await conexion.query(
    'SELECT estado, COUNT(*) AS total FROM asistencias WHERE evento_id = ? GROUP BY estado', [id]
  );
  return { evento: filas[0], puntos, asistenciaStats };
}

/**
 * Valor de la multa por inasistencia: la tarifa vigente en la fecha del evento del concepto
 * MULTA_ASAMBLEA o MULTA_MINGA (Ajustes → Tarifas). No se acepta un valor escrito a mano.
 */
async function multaConfigurada(conexion, tipo, fecha) {
  const concepto = await conceptoPorCodigo(conexion, CONCEPTO_MULTA[tipo]);
  const tarifa = await tarifaVigente(conexion, concepto.id, fecha);
  if (!tarifa || !(Number(tarifa.valor) > 0)) {
    throw conflict(`No hay una tarifa vigente de "${concepto.nombre}" para el ${fecha}. Regístrela en Ajustes → Tarifas o desactive la multa por ausencia.`);
  }
  return Number(tarifa.valor);
}

/** Crea una asamblea o minga con sus puntos del orden del día. La multa se toma de las tarifas. */
async function crearEvento(conexion, datos, cuentaId) {
  if (datos.tipo === 'ASAMBLEA' && datos.fecha < hoy()) {
    throw badRequest('La fecha de la asamblea no puede ser anterior a la fecha actual.');
  }
  const valorMulta = datos.genera_multa_ausencia ? await multaConfigurada(conexion, datos.tipo, datos.fecha) : null;
  const puntos = datos.tipo === 'ASAMBLEA'
    ? datos.puntos_orden_dia
      .map((p) => (typeof p === 'string' ? { punto_tratar: p } : p))
      .map((p) => ({ ...p, punto_tratar: p.punto_tratar.trim() }))
      .filter((p) => p.punto_tratar)
    : [];

  const [r] = await conexion.query(
    `INSERT INTO eventos (tipo, titulo, descripcion, fecha, hora_inicio, hora_fin, lugar, requiere_asistencia,
                          genera_multa_ausencia, valor_multa, created_by_cuenta_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [datos.tipo, datos.titulo, datos.descripcion, datos.fecha, datos.hora_inicio, datos.hora_fin,
      datos.lugar || 'Casa Comunal Junta La Jones', datos.requiere_asistencia, datos.genera_multa_ausencia, valorMulta,
      cuentaId]
  );
  if (puntos.length) {
    await conexion.query(
      'INSERT INTO puntos_asamblea (evento_id, orden, punto_tratar, tratado, resolucion, titulo_acta) VALUES ?',
      [puntos.map((p, i) => [r.insertId, i + 1, p.punto_tratar, p.tratado || null, p.resolucion || null, p.punto_tratar.slice(0, 255)])]
    );
  }
  return { eventoId: r.insertId, valorMulta, puntos: puntos.length };
}

/**
 * Guarda los puntos del orden del día y sus actas: actualiza los existentes por id,
 * crea los nuevos y elimina los que ya no se envían.
 * @returns {{ data: object[], archivosEliminados: string[] }} archivos firmados que quedaron huérfanos
 */
async function guardarPuntos(conexion, id, puntos) {
  const evento = await obtenerEvento(conexion, id, { tipo: 'ASAMBLEA' });
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
}

/** Actualiza los datos del acta de un punto. */
async function actualizarActaPunto(conexion, eventoId, puntoId, cambios) {
  if (!Object.keys(cambios).length) throw badRequest('No se enviaron cambios para el acta.');
  const [r] = await conexion.query('UPDATE puntos_asamblea SET ? WHERE id = ? AND evento_id = ?', [cambios, puntoId, eventoId]);
  if (!r.affectedRows) throw notFound('Punto de asamblea no encontrado.');
  const [[actualizado]] = await conexion.query('SELECT * FROM puntos_asamblea WHERE id = ?', [puntoId]);
  return actualizado;
}

module.exports = {
  listarEventos, listarEventosPublicos, detalleEvento, crearEvento, guardarPuntos, actualizarActaPunto,
  ESTADOS_ASISTENCIA, obtenerEvento, obtenerPadron, cambiarEstado, registrarAsistencias, finalizar, exigirAbierto
};
