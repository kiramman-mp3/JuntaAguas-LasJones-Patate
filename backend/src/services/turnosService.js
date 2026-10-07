/**
 * Reglas de los turnos de riego. Reciben una conexión en transacción.
 * Las horas llegan normalizadas a 'HH:MM:SS', así que se comparan como texto sin ambigüedad
 * ('09:00:00' < '10:00:00'; con '9:00' frente a '10:00' la comparación de texto fallaba).
 */
const { hoy } = require('../shared/dates');
const { badRequest, notFound, conflict } = require('../shared/errors');
const { conceptoPorCodigo, redondear } = require('./finanzasService');

const DIAS = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
/** Valor del turno adicional cuando no se indica un costo. */
const COSTO_ADICIONAL_POR_DEFECTO = 5;

async function verificarPersonaYLote(conexion, personaId, loteId) {
  const [personas] = await conexion.query("SELECT id FROM personas WHERE id = ? AND estado = 'ACTIVO'", [personaId]);
  if (!personas.length) throw notFound('El comunero no existe o está inactivo.');
  if (!loteId) return null;
  const [lotes] = await conexion.query(
    `SELECT l.id, l.codigo, l.activo, (pl.persona_id IS NOT NULL) AS vinculado
     FROM lotes l LEFT JOIN persona_lotes pl ON pl.lote_id = l.id AND pl.persona_id = ?
     WHERE l.id = ?`,
    [personaId, loteId]
  );
  if (!lotes.length || !lotes[0].activo) throw notFound('El lote no existe o está inactivo.');
  if (!Number(lotes[0].vinculado)) throw badRequest(`El lote ${lotes[0].codigo} no está vinculado a este comunero.`);
  return lotes[0];
}

/** Rechaza un turno que se cruce con otro turno activo del mismo lote y día. */
async function verificarSolape(conexion, { loteId, diaSemana, horaInicio, horaFin, excluirId = null }) {
  if (!loteId) return;
  const [solapados] = await conexion.query(
    `SELECT id, hora_inicio, hora_fin FROM turnos_riego
     WHERE lote_id = ? AND dia_semana = ? AND estado = 'ACTIVO' AND (? IS NULL OR id <> ?)
       AND ? < hora_fin AND ? > hora_inicio
     LIMIT 1 FOR UPDATE`,
    [loteId, diaSemana, excluirId, excluirId, horaInicio, horaFin]
  );
  if (solapados.length) {
    const t = solapados[0];
    throw conflict(`El lote ya tiene un turno el ${DIAS[diaSemana]} de ${String(t.hora_inicio).slice(0, 5)} a ${String(t.hora_fin).slice(0, 5)} que se cruza con este horario.`);
  }
}

/**
 * Carga el turno adicional a la cuenta del comunero en la obligación del mes (en hora de Ecuador).
 * Si la del mes ya está pendiente se acumula; si ya se pagó o anuló, se crea una nueva sin mes
 * (la clave única persona/concepto/año/mes no admite dos en el mismo mes).
 */
async function cobrarTurnoAdicional(conexion, { personaId, monto, detalle }) {
  const concepto = await conceptoPorCodigo(conexion, 'TURNO_ADICIONAL');
  const fecha = hoy();
  const anio = Number(fecha.slice(0, 4));
  const mes = Number(fecha.slice(5, 7));
  const [existentes] = await conexion.query(
    `SELECT id, valor, observacion, estado FROM obligaciones
     WHERE persona_id = ? AND concepto_id = ? AND periodo_anio = ? AND periodo_mes = ? FOR UPDATE`,
    [personaId, concepto.id, anio, mes]
  );
  const actual = existentes[0];
  if (actual?.estado === 'PENDIENTE') {
    await conexion.query(
      'UPDATE obligaciones SET valor = ?, observacion = ? WHERE id = ?',
      [redondear(Number(actual.valor) + monto), `${actual.observacion || ''} | ${detalle}`.slice(0, 255), actual.id]
    );
    return actual.id;
  }
  const [r] = await conexion.query(
    `INSERT INTO obligaciones (persona_id, concepto_id, periodo_anio, periodo_mes, fecha_emision, valor, origen, estado, observacion)
     VALUES (?, ?, ?, ?, ?, ?, 'AUTOMATICA', 'PENDIENTE', ?)`,
    [personaId, concepto.id, anio, actual ? null : mes, fecha, monto, detalle.slice(0, 255)]
  );
  return r.insertId;
}

/** Asigna un turno y, si es adicional o tiene costo, genera el cobro en la misma transacción. */
async function crearTurno(conexion, datos) {
  const lote = await verificarPersonaYLote(conexion, datos.persona_id, datos.lote_id);
  await verificarSolape(conexion, { loteId: datos.lote_id, diaSemana: datos.dia_semana, horaInicio: datos.hora_inicio, horaFin: datos.hora_fin });

  const [r] = await conexion.query(
    `INSERT INTO turnos_riego (persona_id, lote_id, tipo, dia_semana, hora_inicio, hora_fin, vigencia_desde, observacion)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [datos.persona_id, datos.lote_id, datos.tipo, datos.dia_semana, datos.hora_inicio, datos.hora_fin, datos.vigencia_desde, datos.observacion]
  );

  const monto = datos.costo ?? (datos.tipo === 'ADICIONAL' ? COSTO_ADICIONAL_POR_DEFECTO : 0);
  let obligacionId = null;
  if (monto > 0) {
    const horario = `${DIAS[datos.dia_semana]} ${datos.hora_inicio.slice(0, 5)}-${datos.hora_fin.slice(0, 5)}`;
    const detalle = `Turno adicional (${horario}, lote ${lote?.codigo ?? 'sin lote'})${datos.observacion ? ` - ${datos.observacion}` : ''}`;
    obligacionId = await cobrarTurnoAdicional(conexion, { personaId: datos.persona_id, monto, detalle });
  }
  return { turnoId: r.insertId, obligacionId, monto };
}

/**
 * Actualiza un turno activo. Los campos que no se envían conservan su valor
 * (antes, omitir `tipo` convertía un turno ADICIONAL en REGULAR).
 */
async function actualizarTurno(conexion, id, cambios) {
  const [filas] = await conexion.query("SELECT * FROM turnos_riego WHERE id = ? AND estado = 'ACTIVO' FOR UPDATE", [id]);
  if (!filas.length) throw notFound('Turno no encontrado.');
  const actual = filas[0];
  const final = {
    persona_id: cambios.persona_id ?? actual.persona_id,
    lote_id: cambios.lote_id ?? actual.lote_id,
    tipo: cambios.tipo ?? actual.tipo,
    dia_semana: cambios.dia_semana ?? actual.dia_semana,
    hora_inicio: cambios.hora_inicio ?? String(actual.hora_inicio),
    hora_fin: cambios.hora_fin ?? String(actual.hora_fin),
    observacion: cambios.observacion === undefined ? actual.observacion : cambios.observacion
  };
  if (final.hora_inicio >= final.hora_fin) throw badRequest('La hora de inicio debe ser menor a la hora de finalización.');
  if (cambios.persona_id !== undefined || cambios.lote_id !== undefined) {
    await verificarPersonaYLote(conexion, final.persona_id, final.lote_id);
  }
  await verificarSolape(conexion, { loteId: final.lote_id, diaSemana: final.dia_semana, horaInicio: final.hora_inicio, horaFin: final.hora_fin, excluirId: id });

  await conexion.query(
    `UPDATE turnos_riego SET persona_id = ?, lote_id = ?, tipo = ?, dia_semana = ?, hora_inicio = ?, hora_fin = ?, observacion = ?
     WHERE id = ?`,
    [final.persona_id, final.lote_id, final.tipo, final.dia_semana, final.hora_inicio, final.hora_fin, final.observacion, id]
  );
  return { antes: actual, despues: final };
}

async function desactivarTurno(conexion, id) {
  const [r] = await conexion.query("UPDATE turnos_riego SET estado = 'INACTIVO' WHERE id = ? AND estado = 'ACTIVO'", [id]);
  if (!r.affectedRows) throw notFound('Turno no encontrado.');
}

module.exports = { DIAS, COSTO_ADICIONAL_POR_DEFECTO, verificarSolape, crearTurno, actualizarTurno, desactivarTurno };
