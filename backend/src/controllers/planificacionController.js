const db = require('../config/db');
const { withTransaction } = require('../shared/transaction');
const { registrarAuditoria } = require('../services/auditService');
const { notFound, conflict, badRequest } = require('../shared/errors');
const s = require('../shared/schemas');
const { z } = s;

const planSchema = z.object({
  anio: z.coerce.number({ error: 'El año de planificación es obligatorio.' }).int().min(2000).max(2100),
  descripcion: s.textoOpcional(255)
});

const actividadSchema = z.object({
  nombre: z.string({ error: 'El nombre de la actividad es obligatorio.' }).trim().min(3, 'Describa la actividad (mínimo 3 caracteres).').max(200),
  descripcion: s.textoOpcional(5000),
  fecha_inicio: s.fecha,
  fecha_fin: s.fecha
}).refine((d) => d.fecha_inicio <= d.fecha_fin, {
  path: ['fecha_fin'], message: 'La fecha de inicio debe ser menor o igual a la fecha de finalización.'
});

const actividadUpdateSchema = z.object({
  nombre: z.string().trim().min(3, 'Describa la actividad (mínimo 3 caracteres).').max(200).optional(),
  descripcion: s.textoOpcional(5000),
  fecha_inicio: s.fecha.optional(),
  fecha_fin: s.fecha.optional(),
  estado: z.enum(['PENDIENTE', 'EN_PROCESO', 'CUMPLIDA', 'NO_CUMPLIDA', 'CANCELADA']).optional(),
  fecha_cumplimiento: s.fechaOpcional,
  observacion_resultado: s.textoOpcional(5000)
}).superRefine((d, ctx) => {
  if (d.fecha_inicio && d.fecha_fin && d.fecha_inicio > d.fecha_fin) {
    ctx.addIssue({ code: 'custom', path: ['fecha_fin'], message: 'La fecha de inicio debe ser menor o igual a la fecha de finalización.' });
  }
});

const planParam = z.object({ planId: s.id });
const actividadParam = z.object({ planId: s.id, actividadId: s.id });

/** Planes anuales con sus actividades: dos consultas en total, no una por plan. */
async function getPlanes(req, res) {
  const [planes] = await db.query('SELECT * FROM planes_anuales ORDER BY anio DESC');
  const [actividades] = planes.length
    ? await db.query('SELECT * FROM actividades_plan WHERE plan_id IN (?) ORDER BY fecha_inicio ASC, id ASC', [planes.map((p) => p.id)])
    : [[]];

  const porPlan = new Map(planes.map((p) => [p.id, []]));
  for (const actividad of actividades) porPlan.get(actividad.plan_id)?.push(actividad);
  return res.json({ status: 'OK', data: planes.map((p) => ({ ...p, actividades: porPlan.get(p.id) })) });
}

async function createPlan(req, res) {
  const { anio, descripcion } = planSchema.parse(req.body);
  let planId;
  try {
    const [r] = await db.query(
      `INSERT INTO planes_anuales (anio, descripcion, estado, created_by_cuenta_id) VALUES (?, ?, 'ACTIVO', ?)`,
      [anio, descripcion, req.user.cuentaId]
    );
    planId = r.insertId;
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') throw conflict(`Ya existe una planificación registrada para el año ${anio}.`);
    throw error;
  }
  await registrarAuditoria({ cuentaId: req.user.cuentaId, accion: 'CREAR', entidad: 'planes_anuales', entidadId: planId, ip: req.ip, detalle: { anio } });
  return res.status(201).json({ status: 'OK', message: 'Plan anual registrado.', planId });
}

async function addActividadPlan(req, res) {
  const { planId } = planParam.parse(req.params);
  const datos = actividadSchema.parse(req.body);
  const actividadId = await withTransaction(async (conexion) => {
    const [planes] = await conexion.query('SELECT id, estado FROM planes_anuales WHERE id = ? FOR UPDATE', [planId]);
    if (!planes.length) throw notFound('Plan anual no encontrado.');
    if (planes[0].estado === 'CERRADO') throw conflict('El plan anual está cerrado y no admite nuevas actividades.');
    const [r] = await conexion.query(
      `INSERT INTO actividades_plan (plan_id, nombre, descripcion, fecha_inicio, fecha_fin, estado)
       VALUES (?, ?, ?, ?, ?, 'PENDIENTE')`,
      [planId, datos.nombre, datos.descripcion, datos.fecha_inicio, datos.fecha_fin]
    );
    return r.insertId;
  });
  await registrarAuditoria({ cuentaId: req.user.cuentaId, accion: 'CREAR', entidad: 'actividades_plan', entidadId: actividadId, ip: req.ip, detalle: { planId, nombre: datos.nombre } });
  return res.status(201).json({ status: 'OK', message: 'Actividad añadida al plan.', actividadId });
}

async function updateActividadPlan(req, res) {
  const { planId, actividadId } = actividadParam.parse(req.params);
  const datos = actividadUpdateSchema.parse(req.body);

  const [filas] = await db.query(
    'SELECT a.*, p.estado AS plan_estado FROM actividades_plan a JOIN planes_anuales p ON p.id = a.plan_id WHERE a.id = ? AND a.plan_id = ?',
    [actividadId, planId]
  );
  if (!filas.length) throw notFound('Actividad no encontrada en este plan anual.');
  const act = filas[0];
  if (act.plan_estado === 'CERRADO') throw conflict('El plan anual está cerrado y no permite modificaciones.');

  const nuevoNombre = datos.nombre !== undefined ? datos.nombre : act.nombre;
  const nuevaDesc = datos.descripcion !== undefined ? datos.descripcion : act.descripcion;
  const nuevaFechaInicio = datos.fecha_inicio !== undefined ? datos.fecha_inicio : act.fecha_inicio;
  const nuevaFechaFin = datos.fecha_fin !== undefined ? datos.fecha_fin : act.fecha_fin;
  const nuevoEstado = datos.estado !== undefined ? datos.estado : act.estado;
  const nuevaFechaCumplimiento = datos.fecha_cumplimiento !== undefined ? datos.fecha_cumplimiento : act.fecha_cumplimiento;
  const nuevaObs = datos.observacion_resultado !== undefined ? datos.observacion_resultado : act.observacion_resultado;

  if (nuevaFechaInicio > nuevaFechaFin) {
    throw badRequest('La fecha de inicio debe ser menor o igual a la fecha de finalización.');
  }

  await db.query(
    `UPDATE actividades_plan
     SET nombre = ?, descripcion = ?, fecha_inicio = ?, fecha_fin = ?,
         estado = ?, fecha_cumplimiento = ?, observacion_resultado = ?
     WHERE id = ? AND plan_id = ?`,
    [nuevoNombre, nuevaDesc, nuevaFechaInicio, nuevaFechaFin, nuevoEstado, nuevaFechaCumplimiento, nuevaObs, actividadId, planId]
  );

  await registrarAuditoria({
    cuentaId: req.user.cuentaId,
    accion: 'ACTUALIZAR',
    entidad: 'actividades_plan',
    entidadId: actividadId,
    ip: req.ip,
    detalle: { planId, estado: nuevoEstado, nombre: nuevoNombre }
  });

  return res.json({ status: 'OK', message: 'Actividad actualizada exitosamente.', data: { id: actividadId, estado: nuevoEstado } });
}

module.exports = { getPlanes, createPlan, addActividadPlan, updateActividadPlan };
