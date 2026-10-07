const db = require('../config/db');
const { registrarAuditoria } = require('../services/auditService');
const finanzas = require('../services/finanzasService');
const { withTransaction } = require('../shared/transaction');
const { personaPermitida } = require('../shared/roles');
const { badRequest, notFound, conflict } = require('../shared/errors');
const { hoy } = require('../shared/dates');
const s = require('../shared/schemas');
const { z } = s;

const ESTADOS_OBLIGACION = ['PENDIENTE', 'PAGADA', 'ANULADA'];
const METODOS = ['EFECTIVO', 'TRANSFERENCIA', 'DEPOSITO', 'OTRO'];
const anio = z.coerce.number().int().min(2000).max(2100);
const mes = z.coerce.number().int().min(1).max(12);

const obligacionesQuery = z.object({
  persona_id: s.id.optional(),
  estado: z.enum(ESTADOS_OBLIGACION).optional(),
  anio: anio.optional(),
  mes: mes.optional()
});

const porCedulaQuery = z.object({
  cedula: z.string({ error: 'Debe enviar la cédula del comunero.' }).trim().regex(/^\d{10}$/, 'La cédula debe tener 10 dígitos.'),
  estado: z.enum(ESTADOS_OBLIGACION).optional(),
  anio: anio.optional(),
  mes: mes.optional()
});

const tarifaSchema = z.object({
  concepto_id: s.id,
  valor: s.montoPositivo,
  vigencia_desde: s.fecha,
  vigencia_hasta: s.fechaOpcional,
  observacion: s.textoOpcional(255)
}).refine((d) => !d.vigencia_hasta || d.vigencia_hasta >= d.vigencia_desde, {
  path: ['vigencia_hasta'], message: 'La vigencia final debe ser posterior a la inicial.'
});

const obligacionSchema = z.object({
  persona_id: s.id,
  concepto_id: s.id,
  periodo_anio: anio.optional(),
  periodo_mes: z.preprocess((v) => (v === '' ? null : v), mes.nullish()),
  fecha_emision: s.fecha,
  fecha_vencimiento: s.fechaOpcional,
  valor: s.montoPositivo,
  observacion: s.textoOpcional(255)
});

const textoObservacion = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() ? v.trim() : null),
  z.string().max(255).nullable()
);

const pagoSchema = z.object({
  persona_id: s.id,
  obligacionesIds: z.array(s.id, { error: 'Seleccione al menos una obligación a pagar.' }).min(1, 'Seleccione al menos una obligación a pagar.').max(200),
  metodo: z.enum(METODOS).default('EFECTIVO'),
  referencia: s.textoOpcional(100),
  observacion: textoObservacion.optional(),
  observaciones: textoObservacion.optional()
}).refine((d) => d.metodo === 'EFECTIVO' || d.referencia, {
  path: ['referencia'], message: 'Ingrese el número de referencia de la transferencia o depósito.'
});

const motivoSchema = z.object({ motivo: z.string({ error: 'Se requiere motivo de anulación.' }).trim().min(5, 'Describa el motivo (mínimo 5 caracteres).').max(255) });

const rangoFechas = z.object({ desde: s.fecha.optional(), hasta: s.fecha.optional() })
  .refine((d) => !d.desde || !d.hasta || d.desde <= d.hasta, { message: 'La fecha inicial debe ser anterior a la final.' });

const egresosQuery = rangoFechas.and(z.object({ proveedor: z.string().trim().max(150).optional() }));
const pagosQuery = rangoFechas.and(z.object({ persona_id: s.id.optional(), estado: z.enum(['VIGENTE', 'ANULADO']).optional() }));

const egresoSchema = z.object({
  fecha: s.fecha.refine((f) => f <= hoy(), 'La fecha del egreso no puede ser futura.'),
  concepto: z.string().trim().min(3, 'Indique el concepto del egreso.').max(200),
  proveedor: s.textoOpcional(150),
  ruc_proveedor: z.preprocess((v) => (v === '' ? null : v), z.string().trim().regex(/^\d{10}(\d{3})?$/, 'El RUC/cédula del proveedor debe tener 10 o 13 dígitos.').nullish()).transform((v) => v ?? null),
  descripcion: s.textoOpcional(2000),
  numero_factura: z.preprocess((v) => (v === '' ? null : v), z.string().trim().regex(/^[\d-]{1,30}$/, 'Número de factura inválido (ej. 001-001-000012345).').nullish()).transform((v) => v ?? null),
  valor: s.montoPositivo
});

const facturacionSchema = z.object({ anio, mes, simular: z.boolean().default(false) });

/** Catálogo de conceptos con la tarifa vigente hoy. */
async function getConceptos(req, res) {
  const fecha = hoy();
  const [conceptos] = await db.query(
    `SELECT c.*,
            (SELECT t.valor FROM tarifas t
             WHERE t.concepto_id = c.id AND t.activo = TRUE AND t.vigencia_desde <= ? AND (t.vigencia_hasta IS NULL OR t.vigencia_hasta >= ?)
             ORDER BY t.vigencia_desde DESC LIMIT 1) AS tarifa_actual
     FROM conceptos_cobro c
     WHERE c.activo = TRUE
     ORDER BY c.nombre ASC`,
    [fecha, fecha]
  );
  return res.json({ status: 'OK', data: conceptos });
}

/** Historial de tarifas. */
async function getTarifas(req, res) {
  const [tarifas] = await db.query(
    `SELECT t.*, c.codigo AS concepto_codigo, c.nombre AS concepto_nombre
     FROM tarifas t JOIN conceptos_cobro c ON c.id = t.concepto_id
     ORDER BY c.nombre, t.vigencia_desde DESC`
  );
  return res.json({ status: 'OK', data: tarifas });
}

/** Registrar una tarifa nueva; la anterior queda vigente hasta el día previo. */
async function createTarifa(req, res) {
  const datos = tarifaSchema.parse(req.body);
  const tarifaId = await withTransaction(async (conexion) => {
    const [conceptos] = await conexion.query('SELECT id FROM conceptos_cobro WHERE id = ?', [datos.concepto_id]);
    if (!conceptos.length) throw notFound('Concepto de cobro no encontrado.');
    return finanzas.registrarTarifa(conexion, {
      conceptoId: datos.concepto_id, valor: datos.valor, vigenciaDesde: datos.vigencia_desde,
      vigenciaHasta: datos.vigencia_hasta, observacion: datos.observacion
    });
  });
  await registrarAuditoria({ cuentaId: req.user.cuentaId, accion: 'CREAR', entidad: 'tarifas', entidadId: tarifaId, ip: req.ip, detalle: datos });
  return res.status(201).json({ status: 'OK', message: 'Tarifa registrada correctamente.', tarifaId });
}

/** Cuentas por cobrar. Un comunero solo recibe las suyas. */
async function getObligaciones(req, res) {
  const filtros = obligacionesQuery.parse(req.query);
  const personaId = personaPermitida(req.user, filtros.persona_id);

  const condiciones = [];
  const params = [];
  if (personaId) { condiciones.push('o.persona_id = ?'); params.push(personaId); }
  if (filtros.estado) { condiciones.push('o.estado = ?'); params.push(filtros.estado); }
  if (filtros.anio) { condiciones.push('o.periodo_anio = ?'); params.push(filtros.anio); }
  if (filtros.mes) { condiciones.push('o.periodo_mes = ?'); params.push(filtros.mes); }

  const [obligaciones] = await db.query(
    `SELECT o.*, c.codigo AS concepto_codigo, c.nombre AS concepto_nombre,
            CONCAT(p.nombres, ' ', p.apellidos) AS comunero_nombre, p.cedula
     FROM obligaciones o
     JOIN personas p ON p.id = o.persona_id
     JOIN conceptos_cobro c ON c.id = o.concepto_id
     ${condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : ''}
     ORDER BY o.fecha_emision DESC, o.id DESC`,
    params
  );
  return res.json({ status: 'OK', data: obligaciones });
}

/** Crear una obligación manual (cuota extraordinaria, reposición, etc.). */
async function createObligacionManual(req, res) {
  const datos = obligacionSchema.parse(req.body);
  const obligacionId = await withTransaction(async (conexion) => {
    const [personas] = await conexion.query("SELECT id FROM personas WHERE id = ? AND estado = 'ACTIVO'", [datos.persona_id]);
    if (!personas.length) throw notFound('El comunero no existe o está inactivo.');
    const [conceptos] = await conexion.query('SELECT id FROM conceptos_cobro WHERE id = ? AND activo = TRUE', [datos.concepto_id]);
    if (!conceptos.length) throw notFound('Concepto de cobro no encontrado.');
    try {
      const [r] = await conexion.query(
        `INSERT INTO obligaciones (persona_id, concepto_id, periodo_anio, periodo_mes, fecha_emision, fecha_vencimiento, valor, origen, estado, observacion)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'MANUAL', 'PENDIENTE', ?)`,
        [datos.persona_id, datos.concepto_id, datos.periodo_anio ?? Number(datos.fecha_emision.slice(0, 4)), datos.periodo_mes ?? null,
          datos.fecha_emision, datos.fecha_vencimiento, datos.valor, datos.observacion]
      );
      return r.insertId;
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') throw conflict('El comunero ya tiene una obligación de ese concepto para el mismo período.');
      throw error;
    }
  });

  await registrarAuditoria({
    cuentaId: req.user.cuentaId, accion: 'CREAR', entidad: 'obligaciones', entidadId: obligacionId, ip: req.ip,
    detalle: { persona_id: datos.persona_id, concepto_id: datos.concepto_id, valor: datos.valor }
  });
  return res.status(201).json({ status: 'OK', message: 'Obligación creada exitosamente.', obligacionId });
}

/** Anular una obligación pendiente. */
async function anularObligacion(req, res) {
  const { id } = s.idParam.parse(req.params);
  const { motivo } = motivoSchema.parse(req.body);

  await withTransaction(async (conexion) => {
    const [filas] = await conexion.query('SELECT estado FROM obligaciones WHERE id = ? FOR UPDATE', [id]);
    if (!filas.length) throw notFound('Obligación no encontrada.');
    if (filas[0].estado !== 'PENDIENTE') {
      throw conflict(`Solo se pueden anular obligaciones pendientes; esta se encuentra ${filas[0].estado}.`);
    }
    await conexion.query(
      `UPDATE obligaciones SET estado = 'ANULADA', anulada_por_cuenta_id = ?, fecha_anulacion = UTC_TIMESTAMP(), motivo_anulacion = ?
       WHERE id = ?`,
      [req.user.cuentaId, motivo, id]
    );
  });

  await registrarAuditoria({ cuentaId: req.user.cuentaId, accion: 'ANULAR', entidad: 'obligaciones', entidadId: id, ip: req.ip, detalle: { motivo } });
  return res.json({ status: 'OK', message: 'Obligación anulada correctamente.' });
}

/** Registrar el pago completo de obligaciones pendientes (sin pagos parciales). */
async function registrarPago(req, res) {
  const datos = pagoSchema.parse(req.body);
  const observacion = datos.observacion ?? datos.observaciones ?? null;

  const resultado = await withTransaction((conexion) => finanzas.registrarPago(conexion, {
    personaId: datos.persona_id,
    obligacionesIds: datos.obligacionesIds,
    metodo: datos.metodo,
    referencia: datos.referencia,
    observacion,
    cuentaId: req.user.cuentaId
  }));

  await registrarAuditoria({
    cuentaId: req.user.cuentaId, accion: 'PAGO', entidad: 'pagos', entidadId: resultado.pagoId, ip: req.ip,
    detalle: { persona_id: datos.persona_id, valorTotal: resultado.valorTotal, obligacionesIds: datos.obligacionesIds, metodo: datos.metodo }
  });
  return res.status(201).json({ status: 'OK', message: 'Pago registrado exitosamente.', ...resultado });
}

/** Pagos registrados. Un comunero solo recibe los suyos. */
async function getPagos(req, res) {
  const filtros = pagosQuery.parse(req.query);
  const personaId = personaPermitida(req.user, filtros.persona_id);

  const condiciones = [];
  const params = [];
  if (personaId) { condiciones.push('p.persona_id = ?'); params.push(personaId); }
  if (filtros.estado) { condiciones.push('p.estado = ?'); params.push(filtros.estado); }
  if (filtros.desde) { condiciones.push('p.fecha_pago >= ?'); params.push(filtros.desde); }
  if (filtros.hasta) { condiciones.push('p.fecha_pago < DATE_ADD(?, INTERVAL 1 DAY)'); params.push(filtros.hasta); }

  const [pagos] = await db.query(
    `SELECT p.*, CONCAT(per.nombres, ' ', per.apellidos) AS comunero_nombre, per.cedula,
            CONCAT(reg.nombres, ' ', reg.apellidos) AS registrado_por_usuario,
            (SELECT COUNT(*) FROM pago_detalles pd WHERE pd.pago_id = p.id) AS obligaciones_pagadas
     FROM pagos p
     JOIN personas per ON per.id = p.persona_id
     LEFT JOIN cuentas c ON c.id = p.registrado_por_cuenta_id
     LEFT JOIN personas reg ON reg.id = c.persona_id
     ${condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : ''}
     ORDER BY p.fecha_pago DESC, p.id DESC`,
    params
  );
  return res.json({ status: 'OK', data: pagos });
}

/** Detalle de un pago (para reimprimir el comprobante). */
async function getPagoById(req, res) {
  const { id } = s.idParam.parse(req.params);
  const [filas] = await db.query(
    `SELECT p.*, CONCAT(per.nombres, ' ', per.apellidos) AS comunero_nombre, per.cedula
     FROM pagos p JOIN personas per ON per.id = p.persona_id WHERE p.id = ?`,
    [id]
  );
  if (!filas.length || personaPermitida(req.user, filas[0].persona_id) !== filas[0].persona_id) {
    throw notFound('Pago no encontrado.');
  }
  const [detalles] = await db.query(
    `SELECT pd.obligacion_id, pd.valor_pagado, o.periodo_anio, o.periodo_mes, o.observacion,
            c.codigo AS concepto_codigo, c.nombre AS concepto_nombre
     FROM pago_detalles pd
     JOIN obligaciones o ON o.id = pd.obligacion_id
     JOIN conceptos_cobro c ON c.id = o.concepto_id
     WHERE pd.pago_id = ?
     ORDER BY o.periodo_anio, o.periodo_mes`,
    [id]
  );
  return res.json({ status: 'OK', data: { ...filas[0], detalles } });
}

/** Anular un pago y devolver sus obligaciones a PENDIENTE. */
async function anularPago(req, res) {
  const { id } = s.idParam.parse(req.params);
  const { motivo } = motivoSchema.parse(req.body);
  const { pago, obligaciones } = await withTransaction((conexion) =>
    finanzas.anularPago(conexion, { pagoId: id, motivo, cuentaId: req.user.cuentaId })
  );
  await registrarAuditoria({
    cuentaId: req.user.cuentaId, accion: 'ANULAR', entidad: 'pagos', entidadId: id, ip: req.ip,
    detalle: { motivo, valorTotal: pago.valor_total, obligaciones }
  });
  return res.json({ status: 'OK', message: 'Pago anulado y obligaciones devueltas a estado PENDIENTE.' });
}

/** Listar egresos. */
async function getEgresos(req, res) {
  const filtros = egresosQuery.parse(req.query);
  const condiciones = [];
  const params = [];
  if (filtros.proveedor) { condiciones.push('e.proveedor LIKE ?'); params.push(`%${filtros.proveedor}%`); }
  if (filtros.desde) { condiciones.push('e.fecha >= ?'); params.push(filtros.desde); }
  if (filtros.hasta) { condiciones.push('e.fecha <= ?'); params.push(filtros.hasta); }

  const [egresos] = await db.query(
    `SELECT e.*, e.proveedor AS proveedor_nombre, e.ruc_proveedor AS proveedor_ruc,
            CONCAT(reg.nombres, ' ', reg.apellidos) AS registrado_por_usuario
     FROM egresos e
     LEFT JOIN cuentas c ON c.id = e.registrado_por_cuenta_id
     LEFT JOIN personas reg ON reg.id = c.persona_id
     ${condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : ''}
     ORDER BY e.fecha DESC, e.id DESC`,
    params
  );
  return res.json({ status: 'OK', data: egresos });
}

/** Registrar egreso. */
async function createEgreso(req, res) {
  const datos = egresoSchema.parse(req.body);
  const [r] = await db.query(
    `INSERT INTO egresos (proveedor, ruc_proveedor, fecha, concepto, descripcion, numero_factura, valor, registrado_por_cuenta_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [datos.proveedor, datos.ruc_proveedor, datos.fecha, datos.concepto, datos.descripcion, datos.numero_factura, datos.valor, req.user.cuentaId]
  );
  await registrarAuditoria({
    cuentaId: req.user.cuentaId, accion: 'CREAR', entidad: 'egresos', entidadId: r.insertId, ip: req.ip,
    detalle: { concepto: datos.concepto, valor: datos.valor, numero_factura: datos.numero_factura }
  });
  return res.status(201).json({ status: 'OK', message: 'Egreso registrado exitosamente.', egresoId: r.insertId });
}

/**
 * Balance: ingresos (pagos vigentes) y egresos del período, cartera pendiente a la fecha,
 * resumen mensual del período (o de los últimos 12 meses) y cartera por concepto.
 */
async function getBalanceReport(req, res) {
  const { desde, hasta } = rangoFechas.parse(req.query);
  const fin = hasta || hoy();
  const inicioDefecto = `${Number(fin.slice(0, 4)) - 1}-${fin.slice(5, 7)}-01`;
  const inicioResumen = desde || inicioDefecto;

  const filtroPagos = ['estado = \'VIGENTE\''];
  const filtroEgresos = [];
  const pIngresos = [];
  const pEgresos = [];
  if (desde) { filtroPagos.push('fecha_pago >= ?'); pIngresos.push(desde); filtroEgresos.push('fecha >= ?'); pEgresos.push(desde); }
  if (hasta) {
    filtroPagos.push('fecha_pago < DATE_ADD(?, INTERVAL 1 DAY)'); pIngresos.push(hasta);
    filtroEgresos.push('fecha <= ?'); pEgresos.push(hasta);
  }

  const [[{ totalIngresos }]] = await db.query(
    `SELECT COALESCE(SUM(valor_total), 0) AS totalIngresos FROM pagos WHERE ${filtroPagos.join(' AND ')}`, pIngresos
  );
  const [[{ totalEgresos }]] = await db.query(
    `SELECT COALESCE(SUM(valor), 0) AS totalEgresos FROM egresos ${filtroEgresos.length ? `WHERE ${filtroEgresos.join(' AND ')}` : ''}`, pEgresos
  );
  const [[cartera]] = await db.query(
    `SELECT COALESCE(SUM(valor), 0) AS totalPendientes,
            COALESCE(SUM(CASE WHEN fecha_vencimiento IS NOT NULL AND fecha_vencimiento < ? THEN valor END), 0) AS totalVencido,
            COUNT(DISTINCT persona_id) AS comunerosConDeuda
     FROM obligaciones WHERE estado = 'PENDIENTE'`,
    [hoy()]
  );
  const [resumenMensual] = await db.query(
    `SELECT mes, SUM(ingresos) AS ingresos, SUM(egresos) AS egresos FROM (
       SELECT DATE_FORMAT(fecha_pago, '%Y-%m') AS mes, valor_total AS ingresos, 0 AS egresos
       FROM pagos WHERE estado = 'VIGENTE' AND fecha_pago >= ? AND fecha_pago < DATE_ADD(?, INTERVAL 1 DAY)
       UNION ALL
       SELECT DATE_FORMAT(fecha, '%Y-%m') AS mes, 0, valor FROM egresos WHERE fecha >= ? AND fecha <= ?
     ) t GROUP BY mes ORDER BY mes DESC`,
    [inicioResumen, fin, inicioResumen, fin]
  );
  const [carteraPorConcepto] = await db.query(
    `SELECT c.codigo, c.nombre, COUNT(*) AS obligaciones, SUM(o.valor) AS total
     FROM obligaciones o JOIN conceptos_cobro c ON c.id = o.concepto_id
     WHERE o.estado = 'PENDIENTE' GROUP BY c.id ORDER BY total DESC`
  );

  return res.json({
    status: 'OK',
    balance: {
      totalIngresos: Number(totalIngresos),
      totalEgresos: Number(totalEgresos),
      totalPendientes: Number(cartera.totalPendientes),
      totalVencido: Number(cartera.totalVencido),
      comunerosConDeuda: Number(cartera.comunerosConDeuda),
      balanceAlDia: finanzas.redondear(Number(totalIngresos) - Number(totalEgresos)),
      desde: desde ?? null,
      hasta: hasta ?? null,
      fechaReporte: new Date().toISOString()
    },
    resumenMensual: resumenMensual.map((m) => ({ mes: m.mes, ingresos: Number(m.ingresos), egresos: Number(m.egresos) })),
    carteraPorConcepto: carteraPorConcepto.map((c) => ({ ...c, total: Number(c.total) }))
  });
}

/** Años con obligaciones registradas (sin anuladas). */
async function getPeriodosObligaciones(req, res) {
  const [periodos] = await db.query(
    `SELECT DISTINCT periodo_anio FROM obligaciones
     WHERE periodo_anio IS NOT NULL AND estado <> 'ANULADA' ORDER BY periodo_anio ASC`
  );
  return res.json({ status: 'OK', data: periodos });
}

async function obligacionesPorCedula(req, res, { mensualidades }) {
  const { cedula, estado, anio: anioFiltro, mes: mesFiltro } = porCedulaQuery.parse(req.query);
  const [personas] = await db.query('SELECT id FROM personas WHERE cedula = ?', [cedula]);
  if (!personas.length) throw notFound('No existe una persona registrada con esa cédula.');

  const params = [personas[0].id];
  let sql = `SELECT o.*, c.codigo AS concepto_codigo, c.nombre AS concepto_nombre,
                    CONCAT(p.nombres, ' ', p.apellidos) AS comunero_nombre, p.cedula
             FROM obligaciones o
             JOIN personas p ON p.id = o.persona_id
             JOIN conceptos_cobro c ON c.id = o.concepto_id
             WHERE o.persona_id = ? AND c.codigo ${mensualidades ? '=' : '<>'} 'AGUA_MENSUAL'`;
  if (estado) { sql += ' AND o.estado = ?'; params.push(estado); }
  if (anioFiltro) { sql += ' AND o.periodo_anio = ?'; params.push(anioFiltro); }
  if (mesFiltro) { sql += ' AND o.periodo_mes = ?'; params.push(mesFiltro); }
  sql += ' ORDER BY o.periodo_anio, o.periodo_mes, o.fecha_emision';

  const [obligaciones] = await db.query(sql, params);
  return res.json({ status: 'OK', data: obligaciones });
}

/** Multas y otros cobros (todo lo que no es cuota mensual de agua) de un comunero. */
const getObligacionesMultas = (req, res) => obligacionesPorCedula(req, res, { mensualidades: false });

/** Cuotas mensuales de agua de un comunero. */
const getObligacionesMensualidad = (req, res) => obligacionesPorCedula(req, res, { mensualidades: true });

/** Emitir (o simular) las cuotas mensuales de agua de un período. */
async function generarFacturacionMensual(req, res) {
  const datos = facturacionSchema.parse(req.body);
  const limite = hoy().slice(0, 7);
  const periodo = `${datos.anio}-${String(datos.mes).padStart(2, '0')}`;
  if (periodo > limite) throw badRequest('No se pueden emitir cuotas de meses futuros.');

  const resultado = await withTransaction((conexion) => finanzas.generarFacturacionMensual(conexion, datos));
  if (!datos.simular && resultado.generadas) {
    await registrarAuditoria({
      cuentaId: req.user.cuentaId, accion: 'CREAR', entidad: 'obligaciones', ip: req.ip,
      detalle: { facturacionMensual: periodo, generadas: resultado.generadas, total: resultado.total }
    });
  }
  const message = datos.simular
    ? `Se emitirían ${resultado.generadas} cuotas de $${resultado.valor.toFixed(2)} (total $${resultado.total.toFixed(2)}).`
    : `Se emitieron ${resultado.generadas} cuotas; ${resultado.existentes} ya estaban emitidas.`;
  return res.status(datos.simular ? 200 : 201).json({ status: 'OK', message, data: resultado });
}

module.exports = {
  getConceptos,
  getTarifas,
  createTarifa,
  getObligaciones,
  createObligacionManual,
  anularObligacion,
  registrarPago,
  anularPago,
  getPagos,
  getPagoById,
  getEgresos,
  createEgreso,
  getBalanceReport,
  getPeriodosObligaciones,
  getObligacionesMultas,
  getObligacionesMensualidad,
  generarFacturacionMensual
};
