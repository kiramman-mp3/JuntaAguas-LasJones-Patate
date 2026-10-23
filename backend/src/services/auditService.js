const db = require('../config/db');
const { withTransaction } = require('../shared/transaction');

/**
 * Registra una acción en la tabla de auditoría.
 *
 * Con `conexion` (la de una transacción) el registro forma parte de esa transacción: si no se puede
 * guardar, el error se propaga y la operación completa se revierte. Así un pago, una anulación o un
 * cambio de cuenta nunca quedan sin su rastro. Sin `conexion` (por ejemplo, el inicio de sesión) el
 * registro es de mejor esfuerzo: un fallo se informa en el log pero no interrumpe la operación.
 *
 * @param {Object} params
 * @param {import('mysql2/promise').PoolConnection} [params.conexion] conexión de la transacción en curso
 * @param {number|null} params.cuentaId
 * @param {string} params.accion - CREAR, MODIFICAR, ANULAR, ELIMINAR, LOGIN, PAGO
 * @param {string} params.entidad - Nombre de la tabla/entidad
 * @param {number|null} params.entidadId - ID del registro afectado
 * @param {string|null} params.ip - Dirección IP del cliente
 * @param {Object|null} params.detalle - Datos adicionales JSON
 */
async function registrarAuditoria({ conexion = null, cuentaId = null, accion, entidad, entidadId = null, ip = null, detalle = null }) {
  const sql = `INSERT INTO auditoria (cuenta_id, accion, entidad, entidad_id, ip, detalle) VALUES (?, ?, ?, ?, ?, ?)`;
  const valores = [cuentaId, accion, entidad, entidadId, ip, detalle ? JSON.stringify(detalle) : null];
  if (conexion) {
    await conexion.query(sql, valores);
    return;
  }
  try {
    await db.query(sql, valores);
  } catch (error) {
    console.error('[Audit Error] No se pudo registrar la auditoría:', error.message);
  }
}

/**
 * Ejecuta `operacion(conexion)` y su registro de auditoría en una sola transacción.
 * `auditoria` es el registro ({ accion, entidad, entidadId, detalle }) o una función que lo arma
 * con el resultado de la operación; si devuelve null no se registra nada.
 * @param {import('express').Request} req petición autenticada (cuenta e IP de la auditoría)
 */
function conAuditoria(req, operacion, auditoria) {
  return withTransaction(async (conexion) => {
    const resultado = await operacion(conexion);
    const datos = typeof auditoria === 'function' ? auditoria(resultado) : auditoria;
    if (datos) await registrarAuditoria({ conexion, cuentaId: req.user.cuentaId, ip: req.ip, ...datos });
    return resultado;
  });
}

module.exports = { registrarAuditoria, conAuditoria };
