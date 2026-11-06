const db = require('../config/db');
const { registrarAuditoria } = require('../services/auditService');
const { notFound, conflict } = require('../shared/errors');
const s = require('../shared/schemas');
const { z } = s;

const ESTADOS_FISICOS = ['NUEVO', 'BUENO', 'REGULAR', 'MALO', 'DADO_DE_BAJA'];

const bienSchema = z.object({
  codigo: s.textoOpcional(50),
  nombre: z.string({ error: 'El nombre del bien es obligatorio.' }).trim().min(2, 'Indique el nombre del bien.').max(150),
  descripcion: s.textoOpcional(5000),
  cantidad: z.coerce.number().int().min(1, 'La cantidad debe ser al menos 1.').max(100000).default(1),
  valor_unitario: s.dineroCon((n) => n.min(0, 'El valor unitario no puede ser negativo.').max(1000000)),
  fecha_adquisicion: s.fechaOpcional,
  estado_fisico: z.preprocess((v) => (typeof v === 'string' ? v.trim().toUpperCase() : v), z.enum(ESTADOS_FISICOS)).default('BUENO'),
  ubicacion: s.textoOpcional(150)
});

const bienUpdateSchema = z.object({
  codigo: s.textoOpcional(50),
  nombre: z.string().trim().min(2, 'Indique el nombre del bien.').max(150).optional(),
  descripcion: s.textoOpcional(5000),
  cantidad: z.coerce.number().int().min(0, 'La cantidad no puede ser negativa.').max(100000).optional(),
  valor_unitario: s.dineroCon((n) => n.min(0, 'El valor unitario no puede ser negativo.').max(1000000)).optional(),
  fecha_adquisicion: s.fechaOpcional,
  estado_fisico: z.preprocess((v) => (typeof v === 'string' ? v.trim().toUpperCase() : v), z.enum(ESTADOS_FISICOS)).optional(),
  ubicacion: s.textoOpcional(150),
  activo: z.boolean().optional()
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

async function updateBien(req, res) {
  const { id } = s.idParam.parse(req.params);
  const datos = bienUpdateSchema.parse(req.body);

  const [existentes] = await db.query('SELECT * FROM bienes_inventario WHERE id = ?', [id]);
  if (!existentes.length) throw notFound('Bien no encontrado en inventario.');
  const bienActual = existentes[0];

  if (datos.codigo && datos.codigo !== bienActual.codigo) {
    const [dup] = await db.query('SELECT id FROM bienes_inventario WHERE codigo = ? AND id != ?', [datos.codigo, id]);
    if (dup.length) throw conflict(`Ya existe un bien con el código ${datos.codigo}.`);
  }

  const nuevoCodigo = datos.codigo !== undefined ? datos.codigo : bienActual.codigo;
  const nuevoNombre = datos.nombre !== undefined ? datos.nombre : bienActual.nombre;
  const nuevaDesc = datos.descripcion !== undefined ? datos.descripcion : bienActual.descripcion;
  const nuevaCant = datos.cantidad !== undefined ? datos.cantidad : bienActual.cantidad;
  const nuevoValor = datos.valor_unitario !== undefined ? datos.valor_unitario : bienActual.valor_unitario;
  const nuevaFecha = datos.fecha_adquisicion !== undefined ? datos.fecha_adquisicion : bienActual.fecha_adquisicion;
  const nuevoEstado = datos.estado_fisico !== undefined ? datos.estado_fisico : bienActual.estado_fisico;
  const nuevaUbicacion = datos.ubicacion !== undefined ? datos.ubicacion : bienActual.ubicacion;
  const nuevoActivo = datos.activo !== undefined ? (datos.activo ? 1 : 0) : (nuevoEstado === 'DADO_DE_BAJA' ? 0 : bienActual.activo);

  await db.query(
    `UPDATE bienes_inventario
     SET codigo = ?, nombre = ?, descripcion = ?, cantidad = ?, valor_unitario = ?,
         fecha_adquisicion = ?, estado_fisico = ?, ubicacion = ?, activo = ?
     WHERE id = ?`,
    [nuevoCodigo, nuevoNombre, nuevaDesc, nuevaCant, nuevoValor, nuevaFecha, nuevoEstado, nuevaUbicacion, nuevoActivo, id]
  );

  await registrarAuditoria({
    cuentaId: req.user.cuentaId,
    accion: 'ACTUALIZAR',
    entidad: 'bienes_inventario',
    entidadId: id,
    ip: req.ip,
    detalle: { nombre: nuevoNombre, cantidad: nuevaCant, estado_fisico: nuevoEstado, activo: nuevoActivo }
  });

  return res.json({ status: 'OK', message: 'Bien de inventario actualizado exitosamente.', data: { id, nombre: nuevoNombre } });
}

module.exports = { getInventario, createBien, updateBien };
