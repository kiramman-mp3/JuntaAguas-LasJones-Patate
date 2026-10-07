const db = require('../config/db');
const { registrarAuditoria } = require('../services/auditService');
const { conflict } = require('../shared/errors');
const s = require('../shared/schemas');
const { z } = s;

const ESTADOS_FISICOS = ['NUEVO', 'BUENO', 'REGULAR', 'MALO', 'DADO_DE_BAJA'];

const bienSchema = z.object({
  codigo: s.textoOpcional(50),
  nombre: z.string({ error: 'El nombre del bien es obligatorio.' }).trim().min(2, 'Indique el nombre del bien.').max(150),
  descripcion: s.textoOpcional(5000),
  cantidad: z.coerce.number().int().min(1, 'La cantidad debe ser al menos 1.').max(100000).default(1),
  valor_unitario: s.dinero.min(0, 'El valor unitario no puede ser negativo.').max(1000000),
  fecha_adquisicion: s.fechaOpcional,
  estado_fisico: z.preprocess((v) => (typeof v === 'string' ? v.trim().toUpperCase() : v), z.enum(ESTADOS_FISICOS)).default('BUENO'),
  ubicacion: s.textoOpcional(150)
});

/** Inventario de bienes activos (una sola consulta). */
async function getInventario(req, res) {
  const [bienes] = await db.query('SELECT * FROM bienes_inventario WHERE activo = TRUE ORDER BY nombre ASC');
  return res.json({ status: 'OK', data: bienes });
}

async function createBien(req, res) {
  const datos = bienSchema.parse(req.body);
  let bienId;
  try {
    const [r] = await db.query(
      `INSERT INTO bienes_inventario (codigo, nombre, descripcion, cantidad, valor_unitario, fecha_adquisicion, estado_fisico, ubicacion)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [datos.codigo, datos.nombre, datos.descripcion, datos.cantidad, datos.valor_unitario, datos.fecha_adquisicion, datos.estado_fisico, datos.ubicacion]
    );
    bienId = r.insertId;
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') throw conflict(`Ya existe un bien con el código ${datos.codigo}.`);
    throw error;
  }
  await registrarAuditoria({
    cuentaId: req.user.cuentaId, accion: 'CREAR', entidad: 'bienes_inventario', entidadId: bienId, ip: req.ip,
    detalle: { nombre: datos.nombre, cantidad: datos.cantidad, valor_unitario: datos.valor_unitario }
  });
  return res.status(201).json({ status: 'OK', message: 'Bien registrado en el inventario.', bienId });
}

module.exports = { getInventario, createBien };
