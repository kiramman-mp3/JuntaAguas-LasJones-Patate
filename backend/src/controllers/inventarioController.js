const db = require('../config/db');
const { registrarAuditoria } = require('../services/auditService');

async function getInventario(req, res, next) {
  try {
    const [bienes] = await db.query(`SELECT * FROM bienes_inventario WHERE activo = TRUE ORDER BY nombre ASC`);
    return res.json({ status: 'OK', data: bienes });
  } catch (error) {
    next(error);
  }
}

async function createBien(req, res, next) {
  try {
    const { codigo, nombre, descripcion, cantidad, valor_unitario, fecha_adquisicion, estado_fisico, ubicacion } = req.body;

    if (!nombre || valor_unitario === undefined) {
      return res.status(400).json({ status: 'ERROR', message: 'Nombre y valor unitario son obligatorios.' });
    }

    const [result] = await db.query(
      `INSERT INTO bienes_inventario (codigo, nombre, descripcion, cantidad, valor_unitario, fecha_adquisicion, estado_fisico, ubicacion)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [codigo || null, nombre.trim(), descripcion || null, cantidad || 1, valor_unitario, fecha_adquisicion || null, estado_fisico || 'BUENO', ubicacion || null]
    );

    await registrarAuditoria({
      cuentaId: req.user ? req.user.cuentaId : null,
      accion: 'CREAR',
      entidad: 'bienes_inventario',
      entidadId: result.insertId,
      ip: req.ip,
      detalle: { nombre, cantidad, valor_unitario }
    });

    return res.status(201).json({ status: 'OK', message: 'Bien registrado en el inventario.', bienId: result.insertId });
  } catch (error) {
    next(error);
  }
}

module.exports = { getInventario, createBien };
