/**
 * Rutas financieras. Validan la entrada (schemas/finanzas), delegan en finanzasService (escrituras)
 * y finanzasConsultas (lecturas), registran la auditoría y responden.
 */
const db = require('../config/db');
const { registrarAuditoria } = require('../services/auditService');
const finanzas = require('../services/finanzasService');
const consultas = require('../services/finanzasConsultas');
const { withTransaction } = require('../shared/transaction');
const { personaPermitida } = require('../shared/roles');
const { badRequest, notFound } = require('../shared/errors');
const { hoy } = require('../shared/dates');
const s = require('../shared/schemas');
const {
  obligacionesQuery, porCedulaQuery, tarifaSchema, obligacionSchema, pagoSchema, motivoSchema, rangoFechas,
  egresosQuery, pagosQuery, egresoSchema, facturacionSchema, resumenFacturacionQuery
} = require('../schemas/finanzas');

/** Catálogo de conceptos con la tarifa vigente hoy. */
async function getConceptos(req, res) {
  return res.json({ status: 'OK', data: await consultas.listarConceptos(db) });
}

/** Historial de tarifas. */
async function getTarifas(req, res) {
  return res.json({ status: 'OK', data: await consultas.listarTarifas(db) });
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
  return res.json({ status: 'OK', data: await consultas.listarObligaciones(db, { ...filtros, personaId }) });
}

/** Crear una obligación manual (cuota extraordinaria, reposición, etc.). */
async function createObligacionManual(req, res) {
  const datos = obligacionSchema.parse(req.body);
  const obligacionId = await withTransaction((conexion) => finanzas.crearObligacionManual(conexion, datos));
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
  await withTransaction((conexion) => finanzas.anularObligacion(conexion, { obligacionId: id, motivo, cuentaId: req.user.cuentaId }));
  await registrarAuditoria({ cuentaId: req.user.cuentaId, accion: 'ANULAR', entidad: 'obligaciones', entidadId: id, ip: req.ip, detalle: { motivo } });
  return res.json({ status: 'OK', message: 'Obligación anulada correctamente.' });
}

/** Registrar el pago completo de obligaciones pendientes (sin pagos parciales). */
async function registrarPago(req, res) {
  const datos = pagoSchema.parse(req.body);
  const resultado = await withTransaction((conexion) => finanzas.registrarPago(conexion, {
    personaId: datos.persona_id,
    obligacionesIds: datos.obligacionesIds,
    metodo: datos.metodo,
    referencia: datos.referencia,
    observacion: datos.observacion ?? datos.observaciones ?? null,
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
  return res.json({ status: 'OK', data: await consultas.listarPagos(db, { ...filtros, personaId }) });
}

/** Detalle de un pago (para reimprimir el comprobante). */
async function getPagoById(req, res) {
  const { id } = s.idParam.parse(req.params);
  const pago = await consultas.detallePago(db, id);
  if (!pago || personaPermitida(req.user, pago.persona_id) !== pago.persona_id) throw notFound('Pago no encontrado.');
  return res.json({ status: 'OK', data: pago });
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

async function getEgresos(req, res) {
  return res.json({ status: 'OK', data: await consultas.listarEgresos(db, egresosQuery.parse(req.query)) });
}

async function createEgreso(req, res) {
  const datos = egresoSchema.parse(req.body);
  const egresoId = await finanzas.registrarEgreso(db, datos, req.user.cuentaId);
  await registrarAuditoria({
    cuentaId: req.user.cuentaId, accion: 'CREAR', entidad: 'egresos', entidadId: egresoId, ip: req.ip,
    detalle: { concepto: datos.concepto, valor: datos.valor, numero_factura: datos.numero_factura }
  });
  return res.status(201).json({ status: 'OK', message: 'Egreso registrado exitosamente.', egresoId });
}

/** Balance del período: ingresos, egresos, cartera, resumen mensual y cartera por concepto. */
async function getBalanceReport(req, res) {
  const reporte = await consultas.balance(db, rangoFechas.parse(req.query));
  return res.json({ status: 'OK', ...reporte });
}

/** Historial anual: ingresos, egresos y balance por año y por mes. */
async function getHistorialAnual(req, res) {
  return res.json({ status: 'OK', data: await consultas.historialAnual(db) });
}

/** Años con obligaciones registradas (sin anuladas). */
async function getPeriodosObligaciones(req, res) {
  return res.json({ status: 'OK', data: await consultas.periodosObligaciones(db) });
}

const porCedula = (mensualidades) => async (req, res) => {
  const filtros = porCedulaQuery.parse(req.query);
  return res.json({ status: 'OK', data: await consultas.obligacionesPorCedula(db, { ...filtros, mensualidades }) });
};

/** Multas y otros cobros (todo lo que no es cuota mensual de agua) de un comunero. */
const getObligacionesMultas = porCedula(false);

/** Cuotas mensuales de agua de un comunero. */
const getObligacionesMensualidad = porCedula(true);

/** Emitir (o simular) las cuotas mensuales de agua de un período. */
async function generarFacturacionMensual(req, res) {
  const datos = facturacionSchema.parse(req.body);
  const periodo = `${datos.anio}-${String(datos.mes).padStart(2, '0')}`;
  if (periodo > hoy().slice(0, 7)) throw badRequest('No se pueden emitir cuotas de meses futuros.');

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

/** Estado de la facturación de agua de un año (por defecto, el actual). */
async function getResumenFacturacion(req, res) {
  const { anio } = resumenFacturacionQuery.parse(req.query);
  const anioResumen = anio ?? Number(hoy().slice(0, 4));
  const meses = await finanzas.resumenFacturacionAnual(db, anioResumen);
  return res.json({ status: 'OK', data: { anio: anioResumen, meses } });
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
  getHistorialAnual,
  getPeriodosObligaciones,
  getObligacionesMultas,
  getObligacionesMensualidad,
  generarFacturacionMensual,
  getResumenFacturacion
};
