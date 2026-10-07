const db = require('../config/db');
const { registrarAuditoria } = require('../services/auditService');

async function getPlanes(req, res, next) {
  try {
    const [planes] = await db.query(`SELECT * FROM planes_anuales ORDER BY anio DESC`);

    for (const p of planes) {
      const [actividades] = await db.query(`SELECT * FROM actividades_plan WHERE plan_id = ? ORDER BY fecha_inicio ASC`, [p.id]);
      p.actividades = actividades;
    }

    return res.json({ status: 'OK', data: planes });
  } catch (error) {
    next(error);
  }
}

async function createPlan(req, res, next) {
  try {
    const { anio, descripcion } = req.body;
    if (!anio) {
      return res.status(400).json({ status: 'ERROR', message: 'El año de planificación es obligatorio.' });
    }

    const [exist] = await db.query(`SELECT id FROM planes_anuales WHERE anio = ?`, [anio]);
    if (exist.length > 0) {
      return res.status(400).json({ status: 'ERROR', message: `Ya existe una planificación registrada para el año ${anio}.` });
    }

    const [result] = await db.query(
      `INSERT INTO planes_anuales (anio, descripcion, estado, created_by_cuenta_id) VALUES (?, ?, 'ACTIVO', ?)`,
      [anio, descripcion || null, req.user.cuentaId]
    );

    return res.status(201).json({ status: 'OK', message: 'Plan anual registrado.', planId: result.insertId });
  } catch (error) {
    next(error);
  }
}

async function addActividadPlan(req, res, next) {
  try {
    const { planId } = req.params;
    const { nombre, descripcion, fecha_inicio, fecha_fin } = req.body;

    if (!nombre || !fecha_inicio || !fecha_fin) {
      return res.status(400).json({ status: 'ERROR', message: 'Nombre, fecha de inicio y fin son obligatorios.' });
    }

    if (fecha_inicio > fecha_fin) {
      return res.status(400).json({ status: 'ERROR', message: 'La fecha de inicio debe ser menor o igual a la fecha de finalización.' });
    }

    const [result] = await db.query(
      `INSERT INTO actividades_plan (plan_id, nombre, descripcion, fecha_inicio, fecha_fin, estado)
       VALUES (?, ?, ?, ?, ?, 'PENDIENTE')`,
      [planId, nombre.trim(), descripcion || null, fecha_inicio, fecha_fin]
    );

    return res.status(201).json({ status: 'OK', message: 'Actividad añadida al plan.', actividadId: result.insertId });
  } catch (error) {
    next(error);
  }
}

module.exports = { getPlanes, createPlan, addActividadPlan };
