/**
 * Reglas de negocio comunes a asambleas y mingas: estados, padrón de asistencia,
 * registro de asistencias y finalización con generación de multas.
 * Todas las funciones reciben una conexión dentro de una transacción.
 */
const { badRequest, notFound, conflict } = require('../shared/errors');
const { hoy, yaOcurrio } = require('../shared/dates');

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

module.exports = { ESTADOS_ASISTENCIA, obtenerEvento, obtenerPadron, cambiarEstado, registrarAsistencias, finalizar, exigirAbierto };
