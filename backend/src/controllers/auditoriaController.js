const db = require('../config/db');

const { z, fechaOpcional } = require('../shared/schemas');
const { inicioDelDiaUtc, finDelDiaUtc } = require('../shared/dates');

const querySchema = z.object({
  entidad: z.string().trim().max(50).optional(),
  accion: z.string().trim().max(50).optional(),
  desde: fechaOpcional,
  hasta: fechaOpcional,
  limit: z.coerce.number().int().min(1).max(100).default(100)
});

/** Registro de auditoría más reciente, con filtros por entidad, acción y días de Ecuador. */
async function getAuditoria(req, res) {
  const { entidad, accion, desde, hasta, limit } = querySchema.parse(req.query);
  const condiciones = [];
  const params = [];
  if (entidad) { condiciones.push('a.entidad = ?'); params.push(entidad); }
  if (accion) { condiciones.push('a.accion = ?'); params.push(accion); }
  // a.fecha se guarda en UTC; los filtros son días de Ecuador.
  if (desde) { condiciones.push('a.fecha >= ?'); params.push(inicioDelDiaUtc(desde)); }
  if (hasta) { condiciones.push('a.fecha < ?'); params.push(finDelDiaUtc(hasta)); }

  const [logs] = await db.query(
    `SELECT a.*, p.cedula AS cuenta_usuario, CONCAT(p.nombres, ' ', p.apellidos) AS persona_nombre
     FROM auditoria a
     LEFT JOIN cuentas c ON c.id = a.cuenta_id
     LEFT JOIN personas p ON p.id = c.persona_id
     ${condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : ''}
     ORDER BY a.fecha DESC, a.id DESC LIMIT ?`,
    [...params, limit]
  );
  return res.json({ status: 'OK', data: logs });
}

module.exports = { getAuditoria };