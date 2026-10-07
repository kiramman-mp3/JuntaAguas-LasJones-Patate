const db = require('../config/db');

/**
 * Registra una acción en la tabla de auditoría
 * @param {Object} params
 * @param {number|null} params.cuentaId
 * @param {string} params.accion - CREAR, MODIFICAR, ANULAR, ELIMINAR, LOGIN, PAGO
 * @param {string} params.entidad - Nombre de la tabla/entidad
 * @param {number|null} params.entidadId - ID del registro afectado
 * @param {string|null} params.ip - Dirección IP del cliente
 * @param {Object|null} params.detalle - Datos adicionales JSON
 */
async function registrarAuditoria({ cuentaId = null, accion, entidad, entidadId = null, ip = null, detalle = null }) {
  try {
    const detalleJson = detalle ? JSON.stringify(detalle) : null;
    await db.query(
      `INSERT INTO auditoria (cuenta_id, accion, entidad, entidad_id, ip, detalle)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [cuentaId, accion, entidad, entidadId, ip, detalleJson]
    );
  } catch (error) {
    console.error('[Audit Error] No se pudo registrar la auditoría:', error.message);
  }
}

module.exports = { registrarAuditoria };
