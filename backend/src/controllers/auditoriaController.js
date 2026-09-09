const db = require('../config/db');

async function getAuditoria(req, res, next) {
  try {
    const { entidad, accion, desde, hasta, limit = 100 } = req.query;

    let sql = `SELECT a.*, c.usuario AS cuenta_usuario, CONCAT(p.nombres, ' ', p.apellidos) AS persona_nombre
               FROM auditoria a
               LEFT JOIN cuentas c ON c.id = a.cuenta_id
               LEFT JOIN personas p ON p.id = c.persona_id
               WHERE 1=1`;
    const params = [];

    if (entidad) {
      sql += ` AND a.entidad = ?`;
      params.push(entidad);
    }
    if (accion) {
      sql += ` AND a.accion = ?`;
      params.push(accion);
    }
    if (desde) {
      sql += ` AND a.fecha >= ?`;
      params.push(desde);
    }
    if (hasta) {
      sql += ` AND a.fecha <= ?`;
      params.push(hasta);
    }

    sql += ` ORDER BY a.fecha DESC LIMIT ?`;
    params.push(parseInt(limit));

    const [logs] = await db.query(sql, params);
    return res.json({ status: 'OK', data: logs });
  } catch (error) {
    next(error);
  }
}

module.exports = { getAuditoria };
