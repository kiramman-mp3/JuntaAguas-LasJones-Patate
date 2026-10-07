/**
 * Reglas financieras reutilizables (API y datos de prueba): pagos, anulaciones,
 * tarifas vigentes y facturación mensual de agua. Reciben una conexión en transacción.
 */
const { badRequest, notFound, conflict } = require('../shared/errors');

const redondear = (n) => Math.round(Number(n) * 100) / 100;

function ultimoDiaDelMes(anio, mes) {
  return new Date(Date.UTC(anio, mes, 0)).toISOString().slice(0, 10);
}

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
 * Genera la cuota mensual de agua para cada comunero activo con al menos un lote activo.
 * Es idempotente: las cuotas ya emitidas del período se respetan (clave única persona/concepto/año/mes).
 */
async function generarFacturacionMensual(conexion, { anio, mes, simular = false }) {
  const concepto = await conceptoPorCodigo(conexion, 'AGUA_MENSUAL');
  const emision = `${anio}-${String(mes).padStart(2, '0')}-01`;
  const tarifa = await tarifaVigente(conexion, concepto.id, emision);
  if (!tarifa) throw conflict(`No hay una tarifa de agua vigente para ${emision}. Registre la tarifa antes de facturar.`);

  const [candidatos] = await conexion.query(
    `SELECT p.id, (o.id IS NOT NULL) AS ya_emitida
     FROM personas p
     LEFT JOIN obligaciones o ON o.persona_id = p.id AND o.concepto_id = ? AND o.periodo_anio = ? AND o.periodo_mes = ?
     WHERE p.estado = 'ACTIVO'
       AND EXISTS (SELECT 1 FROM persona_lotes pl JOIN lotes l ON l.id = pl.lote_id WHERE pl.persona_id = p.id AND l.activo = TRUE)
     ORDER BY p.id`,
    [concepto.id, anio, mes]
  );
  const nuevos = candidatos.filter((c) => !Number(c.ya_emitida));
  const resultado = {
    anio, mes, valor: Number(tarifa.valor), comuneros: candidatos.length,
    generadas: nuevos.length, existentes: candidatos.length - nuevos.length,
    total: redondear(nuevos.length * Number(tarifa.valor))
  };
  if (simular || !nuevos.length) return resultado;

  const vencimiento = ultimoDiaDelMes(anio, mes);
  await conexion.query(
    `INSERT INTO obligaciones (persona_id, concepto_id, periodo_anio, periodo_mes, fecha_emision, fecha_vencimiento, valor, origen, estado, observacion)
     VALUES ?`,
    [nuevos.map((c) => [c.id, concepto.id, anio, mes, emision, vencimiento, tarifa.valor, 'AUTOMATICA', 'PENDIENTE', null])]
  );
  return resultado;
}

/**
 * Estado de la facturación de agua de un año, mes a mes: cuotas emitidas, cobradas y pendientes.
 * Los meses sin emisión también se devuelven (con ceros) para que la interfaz muestre el calendario completo.
 */
async function resumenFacturacionAnual(conexion, anio) {
  const concepto = await conceptoPorCodigo(conexion, 'AGUA_MENSUAL');
  const [filas] = await conexion.query(
    `SELECT periodo_mes AS mes,
            COUNT(*) AS emitidas,
            SUM(estado = 'PAGADA') AS pagadas,
            SUM(estado = 'PENDIENTE') AS pendientes,
            COALESCE(SUM(CASE WHEN estado <> 'ANULADA' THEN valor END), 0) AS total,
            COALESCE(SUM(CASE WHEN estado = 'PAGADA' THEN valor END), 0) AS recaudado
     FROM obligaciones
     WHERE concepto_id = ? AND periodo_anio = ? AND periodo_mes IS NOT NULL AND estado <> 'ANULADA'
     GROUP BY periodo_mes`,
    [concepto.id, anio]
  );
  const porMes = new Map(filas.map((f) => [Number(f.mes), f]));
  return Array.from({ length: 12 }, (_, i) => {
    const f = porMes.get(i + 1);
    return {
      mes: i + 1,
      emitidas: Number(f?.emitidas ?? 0),
      pagadas: Number(f?.pagadas ?? 0),
      pendientes: Number(f?.pendientes ?? 0),
      total: redondear(f?.total ?? 0),
      recaudado: redondear(f?.recaudado ?? 0)
    };
  });
}

/**
 * Registra el pago completo de una o varias obligaciones pendientes del mismo comunero.
 * @returns {{ pagoId: number, valorTotal: number }}
 */
async function registrarPago(conexion, { personaId, obligacionesIds, metodo = 'EFECTIVO', referencia = null, observacion = null, cuentaId, fechaPago = null }) {
  const ids = [...new Set(obligacionesIds.map(Number))];
  const [obligaciones] = await conexion.query(
    'SELECT id, persona_id, valor, estado FROM obligaciones WHERE id IN (?) FOR UPDATE',
    [ids]
  );
  if (obligaciones.length !== ids.length) throw badRequest('Una o más obligaciones seleccionadas no existen.');

  for (const ob of obligaciones) {
    if (Number(ob.persona_id) !== Number(personaId)) {
      throw badRequest(`La obligación #${ob.id} no pertenece al comunero seleccionado.`);
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

module.exports = { redondear, conceptoPorCodigo, tarifaVigente, registrarTarifa, generarFacturacionMensual, resumenFacturacionAnual, registrarPago, anularPago };
