/**
 * Reglas de los turnos de riego semanales. Reciben una conexión en transacción.
 * Las horas llegan normalizadas a 'HH:MM:SS', así que se comparan como texto sin ambigüedad
 * ('09:00:00' < '10:00:00'; con '9:00' frente a '10:00' la comparación de texto fallaba).
 */
const { badRequest, notFound, conflict } = require('../shared/errors');

const DIAS = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

async function verificarPersonaYLote(conexion, personaId, loteId) {
  const [personas] = await conexion.query("SELECT id FROM personas WHERE id = ? AND estado = 'ACTIVO'", [personaId]);
  if (!personas.length) throw notFound('El usuario no existe o está inactivo.');
  if (!loteId) return null;
  const [lotes] = await conexion.query(
    `SELECT l.id, l.codigo, l.activo, l.sector_id, (pl.persona_id IS NOT NULL) AS vinculado
     FROM lotes l LEFT JOIN persona_lotes pl ON pl.lote_id = l.id AND pl.persona_id = ?
     WHERE l.id = ?`,
    [personaId, loteId]
  );
  if (!lotes.length || !lotes[0].activo) throw notFound('El lote no existe o está inactivo.');
  if (!Number(lotes[0].vinculado)) throw badRequest(`El lote ${lotes[0].codigo} no está vinculado a este usuario.`);
  return lotes[0];
}

/**
 * Rechaza un turno que se cruce con otro turno activo del mismo sector y día: el agua de un
 * sector llega por un mismo canal, así que dos lotes del sector no pueden regar a la vez.
 */
async function verificarSolape(conexion, { loteId, diaSemana, horaInicio, horaFin, excluirId = null }) {
  if (!loteId) return;
  const [solapados] = await conexion.query(
    `SELECT t.id, t.hora_inicio, t.hora_fin, l.codigo AS lote_codigo
     FROM turnos_riego t
     JOIN lotes l ON l.id = t.lote_id
     WHERE l.sector_id = (SELECT sector_id FROM lotes WHERE id = ?)
       AND t.dia_semana = ? AND t.estado = 'ACTIVO' AND (? IS NULL OR t.id <> ?)
       AND ? < t.hora_fin AND ? > t.hora_inicio
     LIMIT 1 FOR UPDATE`,
    [loteId, diaSemana, excluirId, excluirId, horaInicio, horaFin]
  );
  if (solapados.length) {
    const t = solapados[0];
    throw conflict(`El sector ya tiene un turno el ${DIAS[diaSemana]} de ${String(t.hora_inicio).slice(0, 5)} a ${String(t.hora_fin).slice(0, 5)} (lote ${t.lote_codigo}) que se cruza con este horario.`);
  }
}

/** Asigna un turno semanal sin cruces de horario dentro del sector. */
async function crearTurno(conexion, datos) {
  await verificarPersonaYLote(conexion, datos.persona_id, datos.lote_id);
  await verificarSolape(conexion, { loteId: datos.lote_id, diaSemana: datos.dia_semana, horaInicio: datos.hora_inicio, horaFin: datos.hora_fin });

  const [r] = await conexion.query(
    `INSERT INTO turnos_riego (persona_id, lote_id, dia_semana, hora_inicio, hora_fin, vigencia_desde, observacion)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [datos.persona_id, datos.lote_id, datos.dia_semana, datos.hora_inicio, datos.hora_fin, datos.vigencia_desde, datos.observacion]
  );
  return { turnoId: r.insertId };
}

/** Actualiza un turno activo. Los campos que no se envían conservan su valor. */
async function actualizarTurno(conexion, id, cambios) {
  const [filas] = await conexion.query("SELECT * FROM turnos_riego WHERE id = ? AND estado = 'ACTIVO' FOR UPDATE", [id]);
  if (!filas.length) throw notFound('Turno no encontrado.');
  const actual = filas[0];
  const final = {
    persona_id: cambios.persona_id ?? actual.persona_id,
    lote_id: cambios.lote_id ?? actual.lote_id,
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
    `UPDATE turnos_riego SET persona_id = ?, lote_id = ?, dia_semana = ?, hora_inicio = ?, hora_fin = ?, observacion = ?
     WHERE id = ?`,
    [final.persona_id, final.lote_id, final.dia_semana, final.hora_inicio, final.hora_fin, final.observacion, id]
  );
  return { antes: actual, despues: final };
}

/**
 * Turnos activos agrupados por sector y día de la semana.
 * `completo` agrega los datos personales (usuario, cédula, observación): solo para la directiva.
 * Sin él, cada turno muestra únicamente lote y horario, para publicarse sin exponer a nadie.
 */
async function cronograma(conexion, { sectorId, diaSemana, completo = false } = {}) {
  const condiciones = ["t.estado = 'ACTIVO'", 's.activo = TRUE'];
  const params = [];
  if (diaSemana) { condiciones.push('t.dia_semana = ?'); params.push(diaSemana); }
  if (sectorId) { condiciones.push('l.sector_id = ?'); params.push(sectorId); }

  const [filas] = await conexion.query(
    `SELECT t.id, t.persona_id, t.lote_id, t.dia_semana, t.hora_inicio, t.hora_fin, t.observacion,
            CONCAT(p.nombres, ' ', p.apellidos) AS usuario_nombre, p.cedula,
            l.codigo AS lote_codigo, l.superficie_m2,
            s.id AS sector_id, s.nombre AS sector_nombre, s.descripcion AS sector_descripcion,
            TIMESTAMPDIFF(MINUTE, t.hora_inicio, t.hora_fin) AS duracion_minutos
     FROM turnos_riego t
     JOIN personas p ON p.id = t.persona_id
     JOIN lotes l ON l.id = t.lote_id
     JOIN sectores s ON s.id = l.sector_id
     WHERE ${condiciones.join(' AND ')}
     ORDER BY s.nombre ASC, t.dia_semana ASC, t.hora_inicio ASC`,
    params
  );

  const sectores = new Map();
  for (const fila of filas) {
    if (!sectores.has(fila.sector_id)) {
      sectores.set(fila.sector_id, {
        sector_id: fila.sector_id,
        sector_nombre: fila.sector_nombre,
        sector_descripcion: fila.sector_descripcion,
        minutos: 0,
        lotes: new Set(),
        turnos: 0,
        dias: DIAS.slice(1).map((nombre, i) => ({ dia_semana: i + 1, dia_nombre: nombre, turnos: [] }))
      });
    }
    const sector = sectores.get(fila.sector_id);
    const minutos = Math.max(0, Number(fila.duracion_minutos) || 0);
    sector.turnos++;
    sector.minutos += minutos;
    sector.lotes.add(fila.lote_id);

    const turno = {
      id: fila.id,
      lote_codigo: fila.lote_codigo,
      hora_inicio: String(fila.hora_inicio).slice(0, 5),
      hora_fin: String(fila.hora_fin).slice(0, 5),
      duracion_minutos: minutos
    };
    if (completo) {
      Object.assign(turno, {
        persona_id: fila.persona_id,
        usuario_nombre: fila.usuario_nombre,
        cedula: fila.cedula,
        lote_id: fila.lote_id,
        superficie_m2: fila.superficie_m2,
        observacion: fila.observacion
      });
    }
    sector.dias[fila.dia_semana - 1]?.turnos.push(turno);
  }

  return [...sectores.values()].map((s) => ({
    sector_id: s.sector_id,
    sector_nombre: s.sector_nombre,
    sector_descripcion: s.sector_descripcion,
    total_turnos: s.turnos,
    total_horas: Number((s.minutos / 60).toFixed(1)),
    total_lotes: s.lotes.size,
    dias: s.dias
  }));
}

async function desactivarTurno(conexion, id) {
  const [r] = await conexion.query("UPDATE turnos_riego SET estado = 'INACTIVO' WHERE id = ? AND estado = 'ACTIVO'", [id]);
  if (!r.affectedRows) throw notFound('Turno no encontrado.');
}

module.exports = { DIAS, verificarSolape, crearTurno, actualizarTurno, desactivarTurno, cronograma };
