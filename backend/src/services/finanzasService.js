/**
 * Reglas financieras reutilizables (API y datos de prueba): pagos, anulaciones,
 * tarifas vigentes y el pago anual de agua. Reciben una conexión en transacción.
 */
const { badRequest, notFound, conflict } = require('../shared/errors');

const redondear = (n) => Math.round(Number(n) * 100) / 100;

/** Plazo para pagar una multa o un cobro manual sin fecha de vencimiento propia. */
const DIAS_PARA_VENCER = 30;

/** 'YYYY-MM-DD' más `dias` días de calendario. */
function sumarDias(fecha, dias) {
  return new Date(Date.parse(`${fecha}T00:00:00Z`) + dias * 86400000).toISOString().slice(0, 10);
}

/** Vencimiento por defecto de una obligación emitida en `fechaEmision`. */
const vencimientoPorDefecto = (fechaEmision) => sumarDias(fechaEmision, DIAS_PARA_VENCER);

async function conceptoPorCodigo(conexion, codigo) {
  const [filas] = await conexion.query('SELECT id, codigo, nombre FROM conceptos_cobro WHERE codigo = ? AND activo = TRUE', [codigo]);
  if (!filas.length) throw conflict(`El concepto ${codigo} no está configurado o está inactivo.`);
  return filas[0];
}

/** Tarifa vigente de un concepto en una fecha (la de inicio más reciente que la cubre). */
async function tarifaVigente(conexion, conceptoId, fecha) {
  const [filas] = await conexion.query(
    `SELECT id, valor, vigencia_desde, vigencia_hasta FROM tarifas
     WHERE concepto_id = ? AND activo = TRUE AND vigencia_desde <= ? AND (vigencia_hasta IS NULL OR vigencia_hasta >= ?)
     ORDER BY vigencia_desde DESC LIMIT 1`,
    [conceptoId, fecha, fecha]
  );
  return filas[0] || null;
}

/**
 * Registra una tarifa y cierra la vigencia de la tarifa abierta anterior del mismo concepto.
 */
async function registrarTarifa(conexion, { conceptoId, valor, vigenciaDesde, vigenciaHasta = null, observacion = null }) {
  const [solapadas] = await conexion.query(
    `SELECT id FROM tarifas WHERE concepto_id = ? AND activo = TRUE AND vigencia_desde >= ? FOR UPDATE`,
    [conceptoId, vigenciaDesde]
  );
  if (solapadas.length) throw conflict('Ya existe una tarifa que inicia en esa fecha o después. Ajuste la fecha de vigencia.');

  await conexion.query(
    `UPDATE tarifas SET vigencia_hasta = DATE_SUB(?, INTERVAL 1 DAY)
     WHERE concepto_id = ? AND activo = TRUE AND (vigencia_hasta IS NULL OR vigencia_hasta >= ?)`,
    [vigenciaDesde, conceptoId, vigenciaDesde]
  );
  const [r] = await conexion.query(
    'INSERT INTO tarifas (concepto_id, valor, vigencia_desde, vigencia_hasta, observacion) VALUES (?, ?, ?, ?, ?)',
    [conceptoId, valor, vigenciaDesde, vigenciaHasta, observacion]
  );
  return r.insertId;
}

/**
 * Registra el pago completo de una o varias obligaciones pendientes del mismo usuario.
 * @returns {{ pagoId: number, valorTotal: number }}
 */
async function registrarPago(conexion, { personaId, obligacionesIds, metodo = 'TRANSFERENCIA', referencia = null, observacion = null, cuentaId, fechaPago = null }) {
  const ids = [...new Set(obligacionesIds.map(Number))];
  const [obligaciones] = await conexion.query(
    'SELECT id, persona_id, valor, estado FROM obligaciones WHERE id IN (?) FOR UPDATE',
    [ids]
  );
  if (obligaciones.length !== ids.length) throw badRequest('Una o más obligaciones seleccionadas no existen.');

  for (const ob of obligaciones) {
    if (Number(ob.persona_id) !== Number(personaId)) {
      throw badRequest(`La obligación #${ob.id} no pertenece al usuario seleccionado.`);
    }
    if (ob.estado !== 'PENDIENTE') {
      throw conflict(`La obligación #${ob.id} ya se encuentra ${ob.estado} y no se puede cobrar.`);
    }
  }

  const valorTotal = redondear(obligaciones.reduce((suma, ob) => suma + Number(ob.valor), 0));
  const [pago] = await conexion.query(
    `INSERT INTO pagos (persona_id, fecha_pago, valor_total, metodo, referencia, estado, observacion, registrado_por_cuenta_id)
     VALUES (?, ?, ?, ?, ?, 'VIGENTE', ?, ?)`,
    [personaId, fechaPago || new Date(), valorTotal, metodo, referencia, observacion, cuentaId]
  );
  await conexion.query('UPDATE obligaciones SET estado = \'PAGADA\' WHERE id IN (?)', [ids]);
  await conexion.query(
    'INSERT INTO pago_detalles (pago_id, obligacion_id, valor_pagado) VALUES ?',
    [obligaciones.map((ob) => [pago.insertId, ob.id, ob.valor])]
  );
  return { pagoId: pago.insertId, valorTotal };
}

/** Anula un pago vigente y devuelve sus obligaciones a PENDIENTE; conserva el detalle como historial. */
async function anularPago(conexion, { pagoId, motivo, cuentaId }) {
  const [pagos] = await conexion.query('SELECT * FROM pagos WHERE id = ? FOR UPDATE', [pagoId]);
  if (!pagos.length) throw notFound('Pago no encontrado.');
  if (pagos[0].estado === 'ANULADO') throw conflict('Este pago ya fue anulado.');

  const [detalles] = await conexion.query('SELECT obligacion_id FROM pago_detalles WHERE pago_id = ?', [pagoId]);
  if (detalles.length) {
    await conexion.query(
      "UPDATE obligaciones SET estado = 'PENDIENTE' WHERE id IN (?) AND estado = 'PAGADA'",
      [detalles.map((d) => d.obligacion_id)]
    );
  }
  await conexion.query(
    `UPDATE pagos SET estado = 'ANULADO', motivo_anulacion = ?, fecha_anulacion = UTC_TIMESTAMP(), anulado_por_cuenta_id = ?
     WHERE id = ?`,
    [motivo, cuentaId, pagoId]
  );
  return { pago: pagos[0], obligaciones: detalles.length };
}

/** Crea una obligación manual (cuota extraordinaria, reposición, etc.). */
async function crearObligacionManual(conexion, datos) {
  const [personas] = await conexion.query("SELECT id FROM personas WHERE id = ? AND estado = 'ACTIVO'", [datos.persona_id]);
  if (!personas.length) throw notFound('El usuario no existe o está inactivo.');
  const [conceptos] = await conexion.query('SELECT id, codigo FROM conceptos_cobro WHERE id = ? AND activo = TRUE', [datos.concepto_id]);
  if (!conceptos.length) throw notFound('Concepto de cobro no encontrado.');
  if (conceptos[0].codigo === 'AGUA_ANUAL') {
    throw badRequest('El pago anual de agua se emite desde Facturación anual, no como obligación manual.');
  }
  try {
    const [r] = await conexion.query(
      `INSERT INTO obligaciones (persona_id, concepto_id, periodo_anio, periodo_mes, fecha_emision, fecha_vencimiento, valor, origen, estado, observacion)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'MANUAL', 'PENDIENTE', ?)`,
      [datos.persona_id, datos.concepto_id, datos.periodo_anio ?? Number(datos.fecha_emision.slice(0, 4)), datos.periodo_mes ?? null,
        datos.fecha_emision, datos.fecha_vencimiento ?? vencimientoPorDefecto(datos.fecha_emision), datos.valor, datos.observacion]
    );
    return r.insertId;
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') throw conflict('El usuario ya tiene una obligación de ese concepto para el mismo período.');
    throw error;
  }
}

/** Anula una obligación pendiente (las pagadas se revierten anulando su pago). */
async function anularObligacion(conexion, { obligacionId, motivo, cuentaId }) {
  const [filas] = await conexion.query('SELECT estado FROM obligaciones WHERE id = ? FOR UPDATE', [obligacionId]);
  if (!filas.length) throw notFound('Obligación no encontrada.');
  if (filas[0].estado !== 'PENDIENTE') {
    throw conflict(`Solo se pueden anular obligaciones pendientes; esta se encuentra ${filas[0].estado}.`);
  }
  await conexion.query(
    `UPDATE obligaciones SET estado = 'ANULADA', anulada_por_cuenta_id = ?, fecha_anulacion = UTC_TIMESTAMP(), motivo_anulacion = ?
     WHERE id = ?`,
    [cuentaId, motivo, obligacionId]
  );
}

/** Registra un egreso de caja. */
async function registrarEgreso(conexion, datos, cuentaId) {
  const [r] = await conexion.query(
    `INSERT INTO egresos (proveedor, ruc_proveedor, fecha, concepto, descripcion, numero_factura, valor, registrado_por_cuenta_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [datos.proveedor, datos.ruc_proveedor, datos.fecha, datos.concepto, datos.descripcion, datos.numero_factura, datos.valor, cuentaId]
  );
  return r.insertId;
}

/** Usuarios activos con al menos un lote activo: son quienes reciben el agua y la pagan. */
const CONDICION_USUARIO_CON_LOTE = `p.estado = 'ACTIVO'
  AND EXISTS (SELECT 1 FROM persona_lotes pl JOIN lotes l ON l.id = pl.lote_id WHERE pl.persona_id = p.id AND l.activo = TRUE)`;

/**
 * Valor del pago anual de un año: el indicado o, si no se indica, la tarifa del concepto
 * AGUA_ANUAL vigente al 1 de enero de ese año (Ajustes → Tarifas).
 */
async function valorAnualAgua(conexion, anio, valorTotal) {
  if (valorTotal != null) return redondear(valorTotal);
  const concepto = await conceptoPorCodigo(conexion, 'AGUA_ANUAL');
  const tarifa = await tarifaVigente(conexion, concepto.id, `${anio}-01-01`);
  if (!tarifa) throw conflict(`No hay una tarifa del pago anual de agua vigente al 1 de enero de ${anio}. Regístrela en Tarifas o indique el valor.`);
  return redondear(tarifa.valor);
}

/**
 * Pago anual de agua: genera la obligación del año para cada usuario activo con al menos un lote.
 * Es idempotente: las obligaciones ya emitidas de ese año se respetan (clave única usuario/año)
 * y conservan su valor. Con `simular` solo calcula cuántas se emitirían.
 * @returns {Promise<{ anio: number, valor: number, usuarios: number, generadas: number, existentes: number, total: number }>}
 */
async function generarObligacionesAnualesAgua(conexion, { anio, valorTotal = null, simular = false, fechaEmision = null }) {
  const valor = await valorAnualAgua(conexion, anio, valorTotal);
  const [candidatos] = await conexion.query(
    `SELECT p.id, (o.id IS NOT NULL) AS ya_emitida
     FROM personas p
     LEFT JOIN obligacion_anual_agua o ON o.persona_id = p.id AND o.periodo_anio = ?
     WHERE ${CONDICION_USUARIO_CON_LOTE}
     ORDER BY p.id`,
    [anio]
  );
  const nuevos = candidatos.filter((c) => !Number(c.ya_emitida));
  const resultado = {
    anio, valor, usuarios: candidatos.length, generadas: nuevos.length,
    existentes: candidatos.length - nuevos.length, total: redondear(nuevos.length * valor)
  };
  if (simular || !nuevos.length) return resultado;

  const emision = fechaEmision ?? `${anio}-01-01`;
  await conexion.query(
    `INSERT INTO obligacion_anual_agua (persona_id, periodo_anio, valor_total, estado, fecha_emision, fecha_vencimiento) VALUES ?`,
    [nuevos.map((c) => [c.id, anio, valor, 'PENDIENTE', emision, `${anio}-12-31`])]
  );
  return resultado;
}

/** Estado del pago anual de agua de un año: obligaciones emitidas, cobradas y pendientes. */
async function resumenAnualAgua(conexion, anio) {
  const [[fila]] = await conexion.query(
    `SELECT COUNT(*) AS emitidas,
            COALESCE(SUM(estado = 'PAGADO'), 0) AS pagadas,
            COALESCE(SUM(estado = 'PENDIENTE'), 0) AS pendientes,
            COALESCE(SUM(valor_total), 0) AS total,
            COALESCE(SUM(CASE WHEN estado = 'PAGADO' THEN valor_total END), 0) AS recaudado
     FROM obligacion_anual_agua WHERE periodo_anio = ?`,
    [anio]
  );
  return {
    anio,
    emitidas: Number(fila.emitidas),
    pagadas: Number(fila.pagadas),
    pendientes: Number(fila.pendientes),
    total: redondear(fila.total),
    recaudado: redondear(fila.recaudado)
  };
}

/** Obligaciones anuales de agua sin pagar de un usuario, de la más antigua a la más reciente. */
async function obligacionesAnualesPendientes(conexion, personaId) {
  const [personas] = await conexion.query('SELECT id FROM personas WHERE id = ?', [personaId]);
  if (!personas.length) throw notFound('El usuario no existe.');
  const [filas] = await conexion.query(
    `SELECT id, persona_id, periodo_anio, valor_total, estado FROM obligacion_anual_agua
     WHERE persona_id = ? AND estado = 'PENDIENTE' ORDER BY periodo_anio ASC`,
    [personaId]
  );
  return filas.map((f) => ({ ...f, valor_total: Number(f.valor_total) }));
}

/**
 * Registra el pago de una o varias obligaciones anuales de agua pendientes del mismo usuario.
 * @returns {{ pagoId: number, valorTotal: number, actualizados: number }}
 */
async function registrarPagoAnualAgua(conexion, { personaId, obligacionesIds, metodo = 'TRANSFERENCIA', referencia = null, observacion = null, cuentaId, fechaPago = null }) {
  const ids = [...new Set(obligacionesIds.map(Number))];
  const [obligaciones] = await conexion.query(
    'SELECT id, persona_id, valor_total, estado FROM obligacion_anual_agua WHERE id IN (?) FOR UPDATE',
    [ids]
  );
  if (obligaciones.length !== ids.length) throw badRequest('Una o más obligaciones anuales seleccionadas no existen.');

  for (const ob of obligaciones) {
    if (Number(ob.persona_id) !== Number(personaId)) {
      throw badRequest(`La obligación anual #${ob.id} no pertenece al usuario seleccionado.`);
    }
    if (ob.estado !== 'PENDIENTE') {
      throw conflict(`La obligación anual #${ob.id} ya se encuentra ${ob.estado} y no se puede cobrar.`);
    }
  }

  const valorTotal = redondear(obligaciones.reduce((suma, ob) => suma + Number(ob.valor_total), 0));
  const [pago] = await conexion.query(
    `INSERT INTO pago_anual_agua (persona_id, valor_total, metodo, referencia, observacion, fecha_pago, registrado_por_cuenta_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [personaId, valorTotal, metodo, referencia, observacion, fechaPago || new Date(), cuentaId]
  );
  await conexion.query("UPDATE obligacion_anual_agua SET estado = 'PAGADO' WHERE id IN (?)", [ids]);
  await conexion.query(
    'INSERT INTO pago_anual_agua_detalle (pago_anual_agua_id, obligacion_anual_agua) VALUES ?',
    [ids.map((obligacionId) => [pago.insertId, obligacionId])]
  );
  return { pagoId: pago.insertId, valorTotal, actualizados: ids.length };
}

module.exports = {
  crearObligacionManual, anularObligacion, registrarEgreso, DIAS_PARA_VENCER, vencimientoPorDefecto,
  redondear, conceptoPorCodigo, tarifaVigente, registrarTarifa, registrarPago, anularPago,
  generarObligacionesAnualesAgua, resumenAnualAgua, obligacionesAnualesPendientes, registrarPagoAnualAgua
};
