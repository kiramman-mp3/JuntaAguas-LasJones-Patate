const db = require('../config/db');
const { registrarAuditoria } = require('../services/auditService');
const { withTransaction } = require('../shared/transaction');
const { generarPasswordTemporal, hashPassword } = require('../shared/passwords');
const { ROLES, esAdmin } = require('../shared/roles');
const { badRequest, forbidden, notFound, conflict } = require('../shared/errors');
const s = require('../shared/schemas');
const { z } = s;

const datosPersona = {
  nombres: z.string().trim().min(1, 'Los nombres son obligatorios.').max(100),
  apellidos: z.string().trim().min(1, 'Los apellidos son obligatorios.').max(100),
  direccion: s.textoOpcional(255),
  telefono: s.telefono,
  celular: s.celular,
  email: s.email,
  fecha_nacimiento: s.fechaOpcional
};

const rolCodigo = z.enum([ROLES.ADMIN, ROLES.USUARIO]);

const listarSchema = s.paginacion.extend({
  busqueda: z.string().trim().max(100).optional(),
  estado: z.enum(['ACTIVO', 'INACTIVO']).optional()
});

const crearSchema = z.object({
  cedula: s.cedula,
  ...datosPersona,
  crearCuenta: z.boolean().default(false),
  rol: rolCodigo.default(ROLES.USUARIO)
});

const actualizarSchema = z.object({
  ...datosPersona,
  estado: z.enum(['ACTIVO', 'INACTIVO']).optional()
});

const cuentaCrearSchema = z.object({ rol: rolCodigo.default(ROLES.USUARIO) });
const cuentaActualizarSchema = z.object({
  rol: rolCodigo.optional(),
  estado: z.enum(['ACTIVA', 'BLOQUEADA', 'INACTIVA']).optional()
}).refine((d) => d.rol || d.estado, 'Indique el rol o el estado a modificar.');

async function idRol(conexion, codigo) {
  const [rows] = await conexion.query('SELECT id FROM roles WHERE codigo = ? AND activo = TRUE', [codigo]);
  if (!rows.length) throw badRequest(`El rol ${codigo} no está configurado.`);
  return rows[0].id;
}

async function cuentaDePersona(conexion, personaId, { bloquear = false } = {}) {
  const [rows] = await conexion.query(
    `SELECT c.id, c.estado, r.codigo AS rol FROM cuentas c JOIN roles r ON r.id = c.rol_id
     WHERE c.persona_id = ?${bloquear ? ' FOR UPDATE' : ''}`,
    [personaId]
  );
  return rows[0] || null;
}

/** Listar y buscar comuneros (directiva). */
async function getPersonas(req, res) {
  const { busqueda, estado, page, limit } = listarSchema.parse(req.query);
  const offset = (page - 1) * limit;

  let where = ' WHERE 1=1';
  const params = [];
  if (estado) {
    where += ' AND p.estado = ?';
    params.push(estado);
  }
  if (busqueda) {
    where += ' AND (p.cedula LIKE ? OR p.nombres LIKE ? OR p.apellidos LIKE ? OR CONCAT(p.nombres, \' \', p.apellidos) LIKE ?)';
    const term = `%${busqueda}%`;
    params.push(term, term, term, term);
  }

  const [personas] = await db.query(
    `SELECT p.id, p.cedula, p.nombres, p.apellidos, p.direccion, p.telefono, p.celular, p.email, p.fecha_nacimiento,
            p.estado, p.created_at,
            (SELECT COUNT(*) FROM persona_lotes pl WHERE pl.persona_id = p.id) AS lotes_count,
            c.estado AS cuenta_estado, r.codigo AS rol
     FROM personas p
     LEFT JOIN cuentas c ON c.persona_id = p.id
     LEFT JOIN roles r ON r.id = c.rol_id
     ${where}
     ORDER BY p.apellidos ASC, p.nombres ASC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM personas p${where}`, params);

  return res.json({ status: 'OK', data: personas, pagination: { total, page, limit } });
}

/** Detalle de un comunero: la directiva ve a cualquiera; un comunero solo a sí mismo. */
async function getPersonaById(req, res) {
  const { id } = s.idParam.parse(req.params);
  if (!esAdmin(req.user) && req.user.personaId !== id) {
    throw forbidden('Solo puede consultar su propia información.');
  }

  const [rows] = await db.query(
    `SELECT p.*, c.estado AS cuenta_estado, c.debe_cambiar_password, c.ultimo_acceso, r.codigo AS rol
     FROM personas p
     LEFT JOIN cuentas c ON c.persona_id = p.id
     LEFT JOIN roles r ON r.id = c.rol_id
     WHERE p.id = ?`,
    [id]
  );
  if (!rows.length) throw notFound('Comunero no encontrado.');

  const [lotes] = await db.query(
    `SELECT l.id, l.sector_id, l.codigo, l.superficie_m2, l.ancho_m, l.largo_m,
            l.latitud_aproximada, l.longitud_aproximada, l.referencia_ubicacion,
            s.nombre AS sector_nombre, pl.tipo_relacion, pl.porcentaje
     FROM persona_lotes pl
     JOIN lotes l ON l.id = pl.lote_id
     JOIN sectores s ON s.id = l.sector_id
     WHERE pl.persona_id = ?`,
    [id]
  );

  const [turnos] = await db.query(
    `SELECT t.id, t.dia_semana, t.hora_inicio, t.hora_fin, t.tipo, t.estado, t.observacion,
            l.codigo AS lote_codigo, s.nombre AS sector_nombre
     FROM turnos_riego t
     LEFT JOIN lotes l ON l.id = t.lote_id
     LEFT JOIN sectores s ON s.id = l.sector_id
     WHERE t.persona_id = ? AND t.estado = 'ACTIVO'
     ORDER BY t.dia_semana ASC, t.hora_inicio ASC`,
    [id]
  );

  const [obligaciones] = await db.query(
    `SELECT o.id, o.periodo_anio, o.periodo_mes, o.fecha_emision, o.fecha_vencimiento,
            o.valor, o.estado, o.observacion, c.codigo AS concepto_codigo, c.nombre AS concepto_nombre
     FROM obligaciones o
     JOIN conceptos_cobro c ON c.id = o.concepto_id
     WHERE o.persona_id = ? AND o.estado = 'PENDIENTE'
     ORDER BY o.fecha_emision DESC`,
    [id]
  );

  return res.json({ status: 'OK', persona: rows[0], lotes, turnos, obligaciones });
}

/** Estado de cuenta (deudas y pagos) por cédula: la directiva o el propio comunero. */
async function consultaPublicaPorCedula(req, res) {
  const cedula = z.string().trim().regex(/^\d{10}$/, 'Cédula inválida.').parse(req.params.cedula);
  if (!esAdmin(req.user) && req.user.cedula !== cedula) {
    throw forbidden('Solo puede consultar sus propias deudas.');
  }

  const [personaRows] = await db.query('SELECT id, cedula, nombres, apellidos, estado FROM personas WHERE cedula = ?', [cedula]);
  if (!personaRows.length) throw notFound('No se encontró ningún comunero registrado con la cédula ingresada.');
  const persona = personaRows[0];

  const [lotesRows] = await db.query(
    `SELECT l.codigo AS lote_codigo, s.nombre AS sector_nombre
     FROM persona_lotes pl
     JOIN lotes l ON l.id = pl.lote_id
     JOIN sectores s ON s.id = l.sector_id
     WHERE pl.persona_id = ? ORDER BY l.codigo LIMIT 1`,
    [persona.id]
  );
  const loteInfo = lotesRows[0] || { lote_codigo: 'N/A', sector_nombre: 'Sin sector asignado' };

  const [obligaciones] = await db.query(
    `SELECT o.id, o.periodo_anio, o.periodo_mes, o.fecha_emision, o.valor, o.estado, o.observacion,
            c.nombre AS concepto_nombre, c.codigo AS concepto_codigo
     FROM obligaciones o
     JOIN conceptos_cobro c ON c.id = o.concepto_id
     WHERE o.persona_id = ? AND o.estado <> 'ANULADA'
     ORDER BY o.estado DESC, o.fecha_emision DESC`,
    [persona.id]
  );

  const totalPendiente = obligaciones
    .filter((o) => o.estado === 'PENDIENTE')
    .reduce((suma, o) => suma + Number(o.valor), 0);

  return res.json({
    status: 'OK',
    resultado: {
      cedula: persona.cedula,
      nombres: `${persona.nombres} ${persona.apellidos}`,
      sector: loteInfo.sector_nombre,
      loteCodigo: loteInfo.lote_codigo,
      totalPendiente: Number(totalPendiente.toFixed(2)),
      deudas: obligaciones.map((o) => ({
        id: o.id,
        concepto: o.concepto_nombre,
        conceptoCodigo: o.concepto_codigo,
        anio: o.periodo_anio || Number(String(o.fecha_emision).slice(0, 4)),
        mes: o.periodo_mes,
        periodo: o.periodo_mes ? `Mes ${o.periodo_mes}` : (o.observacion || 'Cuota/Multa'),
        valor: Number(o.valor),
        estado: o.estado,
        fechaEmision: o.fecha_emision
      }))
    }
  });
}

async function crearCuentaEnTransaccion(conexion, { personaId, rol, creadaPor }) {
  const passwordTemporal = generarPasswordTemporal();
  await conexion.query(
    `INSERT INTO cuentas (persona_id, rol_id, password_hash, debe_cambiar_password, estado, creada_por_cuenta_id)
     VALUES (?, ?, ?, TRUE, 'ACTIVA', ?)`,
    [personaId, await idRol(conexion, rol), await hashPassword(passwordTemporal), creadaPor]
  );
  return passwordTemporal;
}

/**
 * Registrar comunero y, opcionalmente, su cuenta de acceso.
 * La contraseña temporal se devuelve una sola vez para entregarla al comunero.
 */
async function createPersona(req, res) {
  const datos = crearSchema.parse(req.body);

  const resultado = await withTransaction(async (conexion) => {
    const [existe] = await conexion.query('SELECT id FROM personas WHERE cedula = ?', [datos.cedula]);
    if (existe.length) throw conflict(`Ya existe un comunero registrado con la cédula ${datos.cedula}.`);

    const [insert] = await conexion.query(
      `INSERT INTO personas (cedula, nombres, apellidos, direccion, telefono, celular, email, fecha_nacimiento)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [datos.cedula, datos.nombres, datos.apellidos, datos.direccion, datos.telefono, datos.celular, datos.email, datos.fecha_nacimiento]
    );
    const passwordTemporal = datos.crearCuenta
      ? await crearCuentaEnTransaccion(conexion, { personaId: insert.insertId, rol: datos.rol, creadaPor: req.user.cuentaId })
      : null;
    return { personaId: insert.insertId, passwordTemporal };
  });

  await registrarAuditoria({
    cuentaId: req.user.cuentaId, accion: 'CREAR', entidad: 'personas', entidadId: resultado.personaId, ip: req.ip,
    detalle: { cedula: datos.cedula, crearCuenta: datos.crearCuenta, rol: datos.crearCuenta ? datos.rol : null }
  });

  return res.status(201).json({
    status: 'OK',
    message: 'Comunero registrado exitosamente.',
    personaId: resultado.personaId,
    ...(resultado.passwordTemporal ? { passwordTemporal: resultado.passwordTemporal } : {})
  });
}

/** Actualizar datos personales de un comunero. */
async function updatePersona(req, res) {
  const { id } = s.idParam.parse(req.params);
  const datos = actualizarSchema.parse(req.body);

  const cambios = await withTransaction(async (conexion) => {
    const [personaRows] = await conexion.query('SELECT estado FROM personas WHERE id = ? FOR UPDATE', [id]);
    if (!personaRows.length) throw notFound('Comunero no encontrado.');
    const estadoActual = personaRows[0].estado;
    const nuevoEstado = datos.estado ?? estadoActual;

    if (nuevoEstado === 'INACTIVO' && estadoActual === 'ACTIVO') {
      if (id === req.user.personaId) {
        throw forbidden('No puede desactivar su propio registro de persona.');
      }
      const cuenta = await cuentaDePersona(conexion, id);
      if (cuenta && cuenta.rol === 'ADMIN' && cuenta.estado === 'ACTIVA') {
        const [[{ admins }]] = await conexion.query(
          `SELECT COUNT(*) AS admins FROM cuentas c JOIN roles r ON r.id = c.rol_id
           WHERE r.codigo = 'ADMIN' AND c.estado = 'ACTIVA'`
        );
        if (admins <= 1) throw conflict('No se puede desactivar a la persona porque es el último administrador activo.');
      }
    }

    await conexion.query(
      `UPDATE personas
       SET nombres = ?, apellidos = ?, direccion = ?, telefono = ?, celular = ?, email = ?, fecha_nacimiento = ?, estado = ?
       WHERE id = ?`,
      [datos.nombres, datos.apellidos, datos.direccion, datos.telefono, datos.celular, datos.email, datos.fecha_nacimiento, nuevoEstado, id]
    );
    return { nuevoEstado };
  });

  await registrarAuditoria({
    cuentaId: req.user.cuentaId, accion: 'MODIFICAR', entidad: 'personas', entidadId: id, ip: req.ip,
    detalle: { nombres: datos.nombres, apellidos: datos.apellidos, estado: cambios.nuevoEstado }
  });

  return res.json({ status: 'OK', message: 'Datos del comunero actualizados correctamente.' });
}

/** Crear la cuenta de acceso de un comunero que aún no la tiene. */
async function crearCuenta(req, res) {
  const { id } = s.idParam.parse(req.params);
  const { rol } = cuentaCrearSchema.parse(req.body ?? {});

  const passwordTemporal = await withTransaction(async (conexion) => {
    const [persona] = await conexion.query('SELECT id FROM personas WHERE id = ? FOR UPDATE', [id]);
    if (!persona.length) throw notFound('Comunero no encontrado.');
    if (await cuentaDePersona(conexion, id)) throw conflict('El comunero ya tiene una cuenta de acceso.');
    return crearCuentaEnTransaccion(conexion, { personaId: id, rol, creadaPor: req.user.cuentaId });
  });

  await registrarAuditoria({ cuentaId: req.user.cuentaId, accion: 'CREAR', entidad: 'cuentas', entidadId: id, ip: req.ip, detalle: { personaId: id, rol } });
  return res.status(201).json({ status: 'OK', message: 'Cuenta creada. Entregue la contraseña temporal al comunero.', passwordTemporal });
}

/** Cambiar rol o estado de una cuenta. */
async function actualizarCuenta(req, res) {
  const { id } = s.idParam.parse(req.params);
  const cambios = cuentaActualizarSchema.parse(req.body);
  if (id === req.user.personaId) throw forbidden('No puede modificar el rol ni el estado de su propia cuenta.');

  await withTransaction(async (conexion) => {
    const cuenta = await cuentaDePersona(conexion, id, { bloquear: true });
    if (!cuenta) throw notFound('El comunero no tiene cuenta de acceso.');

    const dejaDeSerAdmin = cuenta.rol === ROLES.ADMIN && cuenta.estado === 'ACTIVA' &&
      ((cambios.rol && cambios.rol !== ROLES.ADMIN) || (cambios.estado && cambios.estado !== 'ACTIVA'));
    if (dejaDeSerAdmin) {
      const [[{ admins }]] = await conexion.query(
        `SELECT COUNT(*) AS admins FROM cuentas c JOIN roles r ON r.id = c.rol_id
         WHERE r.codigo = 'ADMIN' AND c.estado = 'ACTIVA' FOR UPDATE`
      );
      if (admins <= 1) throw conflict('Debe existir al menos un administrador activo.');
    }

    if (cambios.rol) await conexion.query('UPDATE cuentas SET rol_id = ? WHERE id = ?', [await idRol(conexion, cambios.rol), cuenta.id]);
    if (cambios.estado) {
      await conexion.query(
        'UPDATE cuentas SET estado = ?, intentos_fallidos = 0, bloqueada_hasta = NULL WHERE id = ?',
        [cambios.estado, cuenta.id]
      );
    }
  });

  await registrarAuditoria({ cuentaId: req.user.cuentaId, accion: 'MODIFICAR', entidad: 'cuentas', entidadId: id, ip: req.ip, detalle: cambios });
  return res.json({ status: 'OK', message: 'Cuenta actualizada correctamente.' });
}

/**
 * Restablecer la contraseña: genera una temporal, obliga a cambiarla e invalida las sesiones abiertas.
 */
async function restablecerPassword(req, res) {
  const { id } = s.idParam.parse(req.params);

  const passwordTemporal = await withTransaction(async (conexion) => {
    const cuenta = await cuentaDePersona(conexion, id, { bloquear: true });
    if (!cuenta) throw notFound('El comunero no tiene cuenta de acceso.');
    const clave = generarPasswordTemporal();
    await conexion.query(
      `UPDATE cuentas SET password_hash = ?, debe_cambiar_password = TRUE, password_updated_at = UTC_TIMESTAMP(3),
              intentos_fallidos = 0, bloqueada_hasta = NULL
       WHERE id = ?`,
      [await hashPassword(clave), cuenta.id]
    );
    return clave;
  });

  await registrarAuditoria({ cuentaId: req.user.cuentaId, accion: 'MODIFICAR', entidad: 'cuentas', entidadId: id, ip: req.ip, detalle: { restablecerPassword: true } });
  return res.json({ status: 'OK', message: 'Contraseña restablecida. Entregue la contraseña temporal al comunero.', passwordTemporal });
}

/** Estadísticas públicas sin datos personales. */
async function getStatsPublicos(req, res) {
  const [[stats]] = await db.query(
    `SELECT (SELECT COUNT(*) FROM personas WHERE estado = 'ACTIVO') AS totalComuneros,
            (SELECT COUNT(*) FROM lotes WHERE activo = TRUE) AS totalLotes,
            (SELECT COUNT(*) FROM sectores WHERE activo = TRUE) AS totalSectores`
  );
  return res.json({ status: 'OK', data: stats });
}

module.exports = {
  getPersonas,
  getPersonaById,
  consultaPublicaPorCedula,
  createPersona,
  updatePersona,
  crearCuenta,
  actualizarCuenta,
  restablecerPassword,
  getStatsPublicos
};
