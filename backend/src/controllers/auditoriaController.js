const db = require('../config/db');

const { z, fechaOpcional } = require('../shared/schemas');

const querySchema = z.object({
  entidad: z.string().trim().max(50).optional(),
  accion: z.string().trim().max(50).optional(),
  desde: fechaOpcional,
  hasta: fechaOpcional,
  limit: z.coerce.number().int().min(1).max(100).default(100)
});

async function getAuditoria(req, res, next) {
  try {
    const { entidad, accion, desde, hasta, limit } = querySchema.parse(req.query);

    let sql = `SELECT a.*, p.cedula AS cuenta_usuario, CONCAT(p.nombres, ' ', p.apellidos) AS persona_nombre
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
      params.push(`${hasta} 23:59:59.999`);
    }

    sql += ` ORDER BY a.fecha DESC LIMIT ?`;
    params.push(limit);

    const [logs] = await db.query(sql, params);
    return res.json({ status: 'OK', data: logs });
  } catch (error) {
    next(error);
  }
}

module.exports = { getAuditoria };
