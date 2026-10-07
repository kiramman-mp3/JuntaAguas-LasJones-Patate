const db = require('../config/db');
const { registrarAuditoria } = require('../services/auditService');
const turnos = require('../services/turnosService');
const { withTransaction } = require('../shared/transaction');
const { personaPermitida } = require('../shared/roles');
const s = require('../shared/schemas');
const { z } = s;

const dia = z.coerce.number({ error: 'Indique el día de la semana.' }).int()
  .min(1, 'El día de la semana debe estar entre 1 (lunes) y 7 (domingo).')
  .max(7, 'El día de la semana debe estar entre 1 (lunes) y 7 (domingo).');
const tipo = z.enum(['REGULAR', 'ADICIONAL']);
const horarioValido = (d) => !d.hora_inicio || !d.hora_fin || d.hora_inicio < d.hora_fin;
const errorHorario = { path: ['hora_fin'], message: 'La hora de inicio debe ser menor a la hora de finalización.' };

const filtrosQuery = z.object({
  persona_id: s.id.optional(),
  lote_id: s.id.optional(),
  sector_id: s.id.optional(),
  dia_semana: dia.optional()
});

const crearSchema = z.object({
  persona_id: s.id,
  lote_id: s.id,
  tipo: tipo.default('REGULAR'),
  dia_semana: dia,
  hora_inicio: s.hora,
  hora_fin: s.hora,
  vigencia_desde: s.fechaOpcional,
  observacion: s.textoOpcional(255),
  costo: z.preprocess((v) => (v === '' || v === null ? undefined : v), s.dinero.min(0, 'El costo no puede ser negativo.').max(1000).optional())
}).refine(horarioValido, errorHorario);

const actualizarSchema = z.object({
  persona_id: s.id.optional(),
  lote_id: s.id.optional(),
  tipo: tipo.optional(),
  dia_semana: dia.optional(),
  hora_inicio: s.hora.optional(),
  hora_fin: s.hora.optional(),
  observacion: z.preprocess((v) => (typeof v === 'string' && !v.trim() ? null : v), z.string().trim().max(255).nullish())
}).refine(horarioValido, errorHorario);

/** Turnos activos. Un comunero solo recibe los suyos. */
async function getTurnos(req, res) {
  const filtros = filtrosQuery.parse(req.query);
  const personaId = personaPermitida(req.user, filtros.persona_id);
  const condiciones = ["t.estado = 'ACTIVO'"];
  const params = [];
  if (filtros.dia_semana) { condiciones.push('t.dia_semana = ?'); params.push(filtros.dia_semana); }
  if (personaId) { condiciones.push('t.persona_id = ?'); params.push(personaId); }
  if (filtros.lote_id) { condiciones.push('t.lote_id = ?'); params.push(filtros.lote_id); }
  if (filtros.sector_id) { condiciones.push('l.sector_id = ?'); params.push(filtros.sector_id); }

  const [filas] = await db.query(
    `SELECT t.id, t.persona_id, t.lote_id, t.tipo, t.dia_semana, t.hora_inicio, t.hora_fin,
            t.vigencia_desde, t.vigencia_hasta, t.estado, t.observacion,
            CONCAT(p.nombres, ' ', p.apellidos) AS comunero_nombre, p.cedula,
            l.codigo AS lote_codigo, s.nombre AS sector_nombre
     FROM turnos_riego t
     JOIN personas p ON p.id = t.persona_id
     LEFT JOIN lotes l ON l.id = t.lote_id
     LEFT JOIN sectores s ON s.id = l.sector_id
     WHERE ${condiciones.join(' AND ')}
     ORDER BY t.dia_semana ASC, t.hora_inicio ASC`,
    params
  );
  return res.json({ status: 'OK', data: filas });
}

/** Asignar un turno sin cruces de horario; un turno adicional genera su cobro en la misma transacción. */
async function createTurno(req, res) {
  const datos = crearSchema.parse(req.body);
  const resultado = await withTransaction((conexion) => turnos.crearTurno(conexion, datos));

  await registrarAuditoria({
    cuentaId: req.user.cuentaId, accion: 'CREAR', entidad: 'turnos_riego', entidadId: resultado.turnoId, ip: req.ip,
    detalle: { ...datos, montoTurno: resultado.monto, obligacionId: resultado.obligacionId }
  });
  const message = resultado.obligacionId
    ? `Turno de agua asignado con éxito. Se generó un cobro automático de $${resultado.monto.toFixed(2)} a la cuenta del comunero.`
    : 'Turno de agua asignado correctamente.';
  return res.status(201).json({ status: 'OK', message, turnoId: resultado.turnoId, obligacionId: resultado.obligacionId });
}

/** Actualizar un turno; los campos omitidos conservan su valor. */
async function updateTurno(req, res) {
  const { id } = s.idParam.parse(req.params);
  const cambios = actualizarSchema.parse(req.body);
  const { antes, despues } = await withTransaction((conexion) => turnos.actualizarTurno(conexion, id, cambios));

  await registrarAuditoria({
    cuentaId: req.user.cuentaId, accion: 'MODIFICAR', entidad: 'turnos_riego', entidadId: id, ip: req.ip,
    detalle: {
      antes: { persona_id: antes.persona_id, lote_id: antes.lote_id, tipo: antes.tipo, dia_semana: antes.dia_semana, hora_inicio: antes.hora_inicio, hora_fin: antes.hora_fin },
      despues
    }
  });
  return res.json({ status: 'OK', message: 'Turno de agua actualizado correctamente.' });
}

/** Desactivar un turno (se conserva como historial). */
async function deleteTurno(req, res) {
  const { id } = s.idParam.parse(req.params);
  await withTransaction((conexion) => turnos.desactivarTurno(conexion, id));
  await registrarAuditoria({ cuentaId: req.user.cuentaId, accion: 'ELIMINAR', entidad: 'turnos_riego', entidadId: id, ip: req.ip, detalle: { id } });
  return res.json({ status: 'OK', message: 'Turno de agua eliminado con éxito.' });
}

module.exports = { getTurnos, createTurno, updateTurno, deleteTurno };
