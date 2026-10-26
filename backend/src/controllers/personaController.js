const db = require('../config/db');
const { registrarAuditoria } = require('../services/auditService');
// Las altas y cambios de usuarios y cuentas guardan su auditoría dentro de la misma transacción.
const { withTransaction } = require('../shared/transaction');
const { generarPasswordTemporal, hashPassword } = require('../shared/passwords');
const { ROLES, esAdmin } = require('../shared/roles');
const { badRequest, forbidden, notFound, conflict } = require('../shared/errors');
const { aCentavos, aDolares } = require('../shared/money');
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
  estado: z.enum(['ACTIVO', 'INACTIVO']).optional(),
  sector_id: s.id.optional()
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

/**
 * Exige que quede al menos otro administrador efectivo (cuenta ACTIVA, rol ADMIN y persona ACTIVA)
 * además de `personaId`. Bloquea esas filas, así dos cambios simultáneos no pueden dejar a la Junta
 * sin administrador.
 */
async function exigirOtroAdministrador(conexion, personaId, mensaje) {
  const [otros] = await conexion.query(
    `SELECT c.id FROM cuentas c
     JOIN roles r ON r.id = c.rol_id
     JOIN personas p ON p.id = c.persona_id
     WHERE r.codigo = 'ADMIN' AND c.estado = 'ACTIVA' AND p.estado = 'ACTIVO' AND c.persona_id <> ?
     FOR UPDATE`,
    [personaId]
  );
  if (!otros.length) throw conflict(mensaje);
}

async function cuentaDePersona(conexion, personaId, { bloquear = false } = {}) {
  const [rows] = await conexion.query(
    `SELECT c.id, c.estado, r.codigo AS rol FROM cuentas c JOIN roles r ON r.id = c.rol_id
     WHERE c.persona_id = ?${bloquear ? ' FOR UPDATE' : ''}`,
    [personaId]
  );
  return rows[0] || null;
}

/** Listar y buscar usuarios (directiva) con filtro por sector geográfico. */
async function getPersonas(req, res) {
  const { busqueda, estado, sector_id, page, limit } = listarSchema.parse(req.query);
  const offset = (page - 1) * limit;

  let where = ' WHERE 1=1';
  const params = [];
  if (estado) {
    where += ' AND p.estado = ?';
    params.push(estado);
  }
  if (sector_id) {
    where += ' AND p.id IN (SELECT pl.persona_id FROM persona_lotes pl JOIN lotes l ON l.id = pl.lote_id WHERE l.sector_id = ?)';
    params.push(sector_id);
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
            (SELECT GROUP_CONCAT(DISTINCT s.nombre ORDER BY s.nombre SEPARATOR ', ')
             FROM persona_lotes pl
             JOIN lotes l ON l.id = pl.lote_id
             JOIN sectores s ON s.id = l.sector_id
             WHERE pl.persona_id = p.id) AS sector_nombre,
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

/** Detalle de un usuario: la directiva ve a cualquiera; un usuario solo a sí mismo. */
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
  if (!rows.length) throw notFound('Usuario no encontrado.');

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
    `SELECT t.id, t.dia_semana, t.hora_inicio, t.hora_fin, t.estado, t.observacion,
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

  const [obligacionesAnuales] = await db.query(
    `SELECT id, periodo_anio, valor_total, estado, fecha_emision, fecha_vencimiento
     FROM obligacion_anual_agua WHERE persona_id = ? AND estado = 'PENDIENTE' ORDER BY periodo_anio`,
    [id]
  );

  return res.json({ status: 'OK', persona: rows[0], lotes, turnos, obligaciones, obligacionesAnuales });
}

/** Estado de cuenta (deudas y pagos) por cédula: la directiva o el propio usuario. */
async function consultaPublicaPorCedula(req, res) {
  const cedula = z.string().trim().regex(/^\d{10}$/, 'Cédula inválida.').parse(req.params.cedula);
  if (!esAdmin(req.user) && req.user.cedula !== cedula) {
    throw forbidden('Solo puede consultar sus propias deudas.');
  }

  const [personaRows] = await db.query('SELECT id, cedula, nombres, apellidos, estado FROM personas WHERE cedula = ?', [cedula]);
  if (!personaRows.length) throw notFound('No se encontró ningún usuario registrado con la cédula ingresada.');
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
            c.nombre AS concepto_nombre, c.codigo AS concepto_codigo,
            (SELECT pd.pago_id
             FROM pago_detalles pd
             JOIN pagos p ON p.id = pd.pago_id AND p.estado = 'VIGENTE'
             WHERE pd.obligacion_id = o.id
             ORDER BY p.id DESC LIMIT 1) AS pago_id
     FROM obligaciones o
     JOIN conceptos_cobro c ON c.id = o.concepto_id
     WHERE o.persona_id = ? AND o.estado <> 'ANULADA'
     ORDER BY o.estado DESC, o.fecha_emision DESC`,
    [persona.id]
  );

  // El agua se cobra una vez al año: sus obligaciones se muestran junto a multas y otros cobros.
  const [anuales] = await db.query(
    `SELECT o.id, o.periodo_anio, o.valor_total, o.estado, o.fecha_emision,
            (SELECT d.pago_anual_agua_id FROM pago_anual_agua_detalle d
             JOIN pago_anual_agua p ON p.id = d.pago_anual_agua_id AND p.estado = 'VIGENTE'
             WHERE d.obligacion_anual_agua = o.id
             ORDER BY d.pago_anual_agua_id DESC LIMIT 1) AS pago_anual_id
     FROM obligacion_anual_agua o
     WHERE o.persona_id = ? AND o.estado <> 'ANULADA'
     ORDER BY o.periodo_anio DESC`,
    [persona.id]
  );

  const deudas = [
    ...anuales.map((o) => ({
      id: o.id,
      tipo: 'AGUA_ANUAL',
      concepto: 'Pago anual de agua',
      conceptoCodigo: 'AGUA_ANUAL',
      anio: o.periodo_anio,
      mes: null,
      periodo: `Año ${o.periodo_anio}`,
      valor: Number(o.valor_total),
      estado: o.estado,
      fechaEmision: o.fecha_emision,
      pagoId: null,
      pagoAnualId: o.pago_anual_id || null
    })),
    ...obligaciones.map((o) => ({
      id: o.id,
      tipo: 'OBLIGACION',
      concepto: o.concepto_nombre,
      conceptoCodigo: o.concepto_codigo,
      anio: o.periodo_anio || Number(String(o.fecha_emision).slice(0, 4)),
      mes: o.periodo_mes,
      periodo: o.periodo_mes ? `Mes ${o.periodo_mes}` : (o.observacion || 'Cuota/Multa'),
      valor: Number(o.valor),
      estado: o.estado,
      fechaEmision: o.fecha_emision,
      pagoId: o.pago_id || null,
      pagoAnualId: null
    }))
  ];
  const totalPendiente = aDolares(deudas.filter((d) => d.estado === 'PENDIENTE').reduce((suma, d) => suma + aCentavos(d.valor), 0));

  return res.json({
    status: 'OK',
    resultado: {
      cedula: persona.cedula,
      nombres: `${persona.nombres} ${persona.apellidos}`,
      sector: loteInfo.sector_nombre,
      loteCodigo: loteInfo.lote_codigo,
      totalPendiente,
      deudas
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
 * Registrar usuario y, opcionalmente, su cuenta de acceso.
 * La contraseña temporal se devuelve una sola vez para entregarla al usuario.
 */
async function createPersona(req, res) {
  const datos = crearSchema.parse(req.body);

  const resultado = await withTransaction(async (conexion) => {
    const [existe] = await conexion.query('SELECT id FROM personas WHERE cedula = ?', [datos.cedula]);
    if (existe.length) throw conflict(`Ya existe un usuario registrado con la cédula ${datos.cedula}.`);

    const [insert] = await conexion.query(
      `INSERT INTO personas (cedula, nombres, apellidos, direccion, telefono, celular, email, fecha_nacimiento)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [datos.cedula, datos.nombres, datos.apellidos, datos.direccion, datos.telefono, datos.celular, datos.email, datos.fecha_nacimiento]
    );
    const passwordTemporal = datos.crearCuenta
      ? await crearCuentaEnTransaccion(conexion, { personaId: insert.insertId, rol: datos.rol, creadaPor: req.user.cuentaId })
      : null;
    await registrarAuditoria({
      conexion, cuentaId: req.user.cuentaId, accion: 'CREAR', entidad: 'personas', entidadId: insert.insertId, ip: req.ip,
      detalle: { cedula: datos.cedula, crearCuenta: datos.crearCuenta, rol: datos.crearCuenta ? datos.rol : null }
    });
    return { personaId: insert.insertId, passwordTemporal };
  });

  return res.status(201).json({
    status: 'OK',
    message: 'Usuario registrado exitosamente.',
    personaId: resultado.personaId,
    ...(resultado.passwordTemporal ? { passwordTemporal: resultado.passwordTemporal } : {})
  });
}

/** Actualizar datos personales de un usuario. */
async function updatePersona(req, res) {
  const { id } = s.idParam.parse(req.params);
  const datos = actualizarSchema.parse(req.body);

  await withTransaction(async (conexion) => {
    const [personaRows] = await conexion.query('SELECT estado FROM personas WHERE id = ? FOR UPDATE', [id]);
    if (!personaRows.length) throw notFound('Usuario no encontrado.');
    const estadoActual = personaRows[0].estado;
    const nuevoEstado = datos.estado ?? estadoActual;

    if (nuevoEstado === 'INACTIVO' && estadoActual === 'ACTIVO') {
      if (id === req.user.personaId) {
        throw forbidden('No puede desactivar su propio registro de persona.');
      }
      const cuenta = await cuentaDePersona(conexion, id, { bloquear: true });
      if (cuenta && cuenta.rol === ROLES.ADMIN && cuenta.estado === 'ACTIVA') {
        await exigirOtroAdministrador(conexion, id, 'No se puede desactivar a la persona porque es el último administrador activo.');
      }
    }

    await conexion.query(
      `UPDATE personas
       SET nombres = ?, apellidos = ?, direccion = ?, telefono = ?, celular = ?, email = ?, fecha_nacimiento = ?, estado = ?
       WHERE id = ?`,
      [datos.nombres, datos.apellidos, datos.direccion, datos.telefono, datos.celular, datos.email, datos.fecha_nacimiento, nuevoEstado, id]
    );
    await registrarAuditoria({
      conexion, cuentaId: req.user.cuentaId, accion: 'MODIFICAR', entidad: 'personas', entidadId: id, ip: req.ip,
      detalle: { nombres: datos.nombres, apellidos: datos.apellidos, estado: nuevoEstado }
    });
  });

  return res.json({ status: 'OK', message: 'Datos del usuario actualizados correctamente.' });
}

/** Crear la cuenta de acceso de un usuario que aún no la tiene. */
async function crearCuenta(req, res) {
  const { id } = s.idParam.parse(req.params);
  const { rol } = cuentaCrearSchema.parse(req.body ?? {});

  const passwordTemporal = await withTransaction(async (conexion) => {
    const [persona] = await conexion.query('SELECT id FROM personas WHERE id = ? FOR UPDATE', [id]);
    if (!persona.length) throw notFound('Usuario no encontrado.');
    if (await cuentaDePersona(conexion, id)) throw conflict('El usuario ya tiene una cuenta de acceso.');
    const clave = await crearCuentaEnTransaccion(conexion, { personaId: id, rol, creadaPor: req.user.cuentaId });
    await registrarAuditoria({ conexion, cuentaId: req.user.cuentaId, accion: 'CREAR', entidad: 'cuentas', entidadId: id, ip: req.ip, detalle: { personaId: id, rol } });
    return clave;
  });
  return res.status(201).json({ status: 'OK', message: 'Cuenta creada. Entregue la contraseña temporal al usuario.', passwordTemporal });
}

/** Cambiar rol o estado de una cuenta. */
async function actualizarCuenta(req, res) {
  const { id } = s.idParam.parse(req.params);
  const cambios = cuentaActualizarSchema.parse(req.body);
  if (id === req.user.personaId) throw forbidden('No puede modificar el rol ni el estado de su propia cuenta.');

  await withTransaction(async (conexion) => {
    const cuenta = await cuentaDePersona(conexion, id, { bloquear: true });
    if (!cuenta) throw notFound('El usuario no tiene cuenta de acceso.');

    const dejaDeSerAdmin = cuenta.rol === ROLES.ADMIN && cuenta.estado === 'ACTIVA' &&
      ((cambios.rol && cambios.rol !== ROLES.ADMIN) || (cambios.estado && cambios.estado !== 'ACTIVA'));
    if (dejaDeSerAdmin) await exigirOtroAdministrador(conexion, id, 'Debe existir al menos un administrador activo.');

    if (cambios.rol) await conexion.query('UPDATE cuentas SET rol_id = ? WHERE id = ?', [await idRol(conexion, cambios.rol), cuenta.id]);
    if (cambios.estado) {
      await conexion.query(
        'UPDATE cuentas SET estado = ?, intentos_fallidos = 0, bloqueada_hasta = NULL WHERE id = ?',
        [cambios.estado, cuenta.id]
      );
    }
    await registrarAuditoria({ conexion, cuentaId: req.user.cuentaId, accion: 'MODIFICAR', entidad: 'cuentas', entidadId: id, ip: req.ip, detalle: cambios });
  });
  return res.json({ status: 'OK', message: 'Cuenta actualizada correctamente.' });
}

/**
 * Restablecer la contraseña: genera una temporal, obliga a cambiarla e invalida las sesiones abiertas.
 */
async function restablecerPassword(req, res) {
  const { id } = s.idParam.parse(req.params);

  const passwordTemporal = await withTransaction(async (conexion) => {
    const cuenta = await cuentaDePersona(conexion, id, { bloquear: true });
    if (!cuenta) throw notFound('El usuario no tiene cuenta de acceso.');
    const clave = generarPasswordTemporal();
    await conexion.query(
      `UPDATE cuentas SET password_hash = ?, debe_cambiar_password = TRUE, password_updated_at = UTC_TIMESTAMP(3),
              intentos_fallidos = 0, bloqueada_hasta = NULL
       WHERE id = ?`,
      [await hashPassword(clave), cuenta.id]
    );
    await registrarAuditoria({ conexion, cuentaId: req.user.cuentaId, accion: 'MODIFICAR', entidad: 'cuentas', entidadId: id, ip: req.ip, detalle: { restablecerPassword: true } });
    return clave;
  });
  return res.json({ status: 'OK', message: 'Contraseña restablecida. Entregue la contraseña temporal al usuario.', passwordTemporal });
}

/** Estadísticas públicas sin datos personales. */
async function getStatsPublicos(req, res) {
  const [[stats]] = await db.query(
    `SELECT (SELECT COUNT(*) FROM personas WHERE estado = 'ACTIVO') AS totalUsuarios,
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
