/**
 * Consultas de lectura del módulo financiero: obligaciones, pagos, egresos y balance.
 * Reciben `conexion` (el pool o una conexión) para poder usarse dentro o fuera de una transacción.
 *
 * Fechas: pagos.fecha_pago es un instante guardado en UTC; egresos.fecha y las fechas de las
 * obligaciones son días de calendario. Los filtros 'desde'/'hasta' son días de Ecuador, así que
 * sobre fecha_pago se traducen al intervalo UTC de ese día (un pago a las 20:00 del 7 de octubre
 * en Ecuador es el 8 de octubre en UTC y antes quedaba fuera del filtro del día 7).
 */
const { hoy, inicioDelDiaUtc, finDelDiaUtc, ZONA_MYSQL } = require('../shared/dates');
const { notFound } = require('../shared/errors');
const { aCentavos, aDolares, restarMontos } = require('../shared/money');

const where = (condiciones) => (condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '');

/** Condiciones sobre fecha_pago para un rango de días de Ecuador. */
function filtroFechaPago(columna, { desde, hasta }, condiciones, params) {
  if (desde) { condiciones.push(`${columna} >= ?`); params.push(inicioDelDiaUtc(desde)); }
  if (hasta) { condiciones.push(`${columna} < ?`); params.push(finDelDiaUtc(hasta)); }
}

/** Conceptos de cobro activos con la tarifa vigente en `fecha`. */
async function listarConceptos(conexion, fecha = hoy()) {
  const [filas] = await conexion.query(
    `SELECT c.*,
            (SELECT t.valor FROM tarifas t
             WHERE t.concepto_id = c.id AND t.activo = TRUE AND t.vigencia_desde <= ? AND (t.vigencia_hasta IS NULL OR t.vigencia_hasta >= ?)
             ORDER BY t.vigencia_desde DESC LIMIT 1) AS tarifa_actual
     FROM conceptos_cobro c
     WHERE c.activo = TRUE
     ORDER BY c.nombre ASC`,
    [fecha, fecha]
  );
  return filas;
}

/** Historial de tarifas por concepto, de la más reciente a la más antigua. */
async function listarTarifas(conexion) {
  const [filas] = await conexion.query(
    `SELECT t.*, c.codigo AS concepto_codigo, c.nombre AS concepto_nombre
     FROM tarifas t JOIN conceptos_cobro c ON c.id = t.concepto_id
     ORDER BY c.nombre, t.vigencia_desde DESC`
  );
  return filas;
}

async function listarObligaciones(conexion, { personaId, estado, anio, mes }) {
  const condiciones = [];
  const params = [];
  if (personaId) { condiciones.push('o.persona_id = ?'); params.push(personaId); }
  if (estado) { condiciones.push('o.estado = ?'); params.push(estado); }
  if (anio) { condiciones.push('o.periodo_anio = ?'); params.push(anio); }
  if (mes) { condiciones.push('o.periodo_mes = ?'); params.push(mes); }
  const [filas] = await conexion.query(
    `SELECT o.*, c.codigo AS concepto_codigo, c.nombre AS concepto_nombre,
            CONCAT(p.nombres, ' ', p.apellidos) AS comunero_nombre, p.cedula
     FROM obligaciones o
     JOIN personas p ON p.id = o.persona_id
     JOIN conceptos_cobro c ON c.id = o.concepto_id
     ${where(condiciones)}
     ORDER BY o.fecha_emision DESC, o.id DESC`,
    params
  );
  return filas;
}

/** Obligaciones de un comunero por cédula: solo cuotas de agua o todo lo demás (multas y otros). */
async function obligacionesPorCedula(conexion, { cedula, estado, anio, mes, mensualidades }) {
  const [personas] = await conexion.query('SELECT id FROM personas WHERE cedula = ?', [cedula]);
  if (!personas.length) throw notFound('No existe una persona registrada con esa cédula.');

  const condiciones = ['o.persona_id = ?', `c.codigo ${mensualidades ? '=' : '<>'} 'AGUA_MENSUAL'`];
  const params = [personas[0].id];
  if (estado) { condiciones.push('o.estado = ?'); params.push(estado); }
  if (anio) { condiciones.push('o.periodo_anio = ?'); params.push(anio); }
  if (mes) { condiciones.push('o.periodo_mes = ?'); params.push(mes); }
  const [filas] = await conexion.query(
    `SELECT o.*, c.codigo AS concepto_codigo, c.nombre AS concepto_nombre,
            CONCAT(p.nombres, ' ', p.apellidos) AS comunero_nombre, p.cedula
     FROM obligaciones o
     JOIN personas p ON p.id = o.persona_id
     JOIN conceptos_cobro c ON c.id = o.concepto_id
     ${where(condiciones)}
     ORDER BY o.periodo_anio, o.periodo_mes, o.fecha_emision`,
    params
  );
  return filas;
}

/** Años con obligaciones registradas (sin anuladas). */
async function periodosObligaciones(conexion) {
  const [filas] = await conexion.query(
    `SELECT DISTINCT periodo_anio FROM obligaciones
     WHERE periodo_anio IS NOT NULL AND estado <> 'ANULADA' ORDER BY periodo_anio ASC`
  );
  return filas;
}

async function listarPagos(conexion, { personaId, estado, desde, hasta }) {
  const condiciones = [];
  const params = [];
  if (personaId) { condiciones.push('p.persona_id = ?'); params.push(personaId); }
  if (estado) { condiciones.push('p.estado = ?'); params.push(estado); }
  filtroFechaPago('p.fecha_pago', { desde, hasta }, condiciones, params);
  const [filas] = await conexion.query(
    `SELECT p.*, CONCAT(per.nombres, ' ', per.apellidos) AS comunero_nombre, per.cedula,
            CONCAT(reg.nombres, ' ', reg.apellidos) AS registrado_por_usuario,
            (SELECT COUNT(*) FROM pago_detalles pd WHERE pd.pago_id = p.id) AS obligaciones_pagadas
     FROM pagos p
     JOIN personas per ON per.id = p.persona_id
     LEFT JOIN cuentas c ON c.id = p.registrado_por_cuenta_id
     LEFT JOIN personas reg ON reg.id = c.persona_id
     ${where(condiciones)}
     ORDER BY p.fecha_pago DESC, p.id DESC`,
    params
  );
  return filas;
}

/** Pago con sus líneas (para reimprimir el comprobante). Devuelve null si no existe. */
async function detallePago(conexion, id) {
  const [filas] = await conexion.query(
    `SELECT p.*, CONCAT(per.nombres, ' ', per.apellidos) AS comunero_nombre, per.cedula
     FROM pagos p JOIN personas per ON per.id = p.persona_id WHERE p.id = ?`,
    [id]
  );
  if (!filas.length) return null;
  const [detalles] = await conexion.query(
    `SELECT pd.obligacion_id, pd.valor_pagado, o.periodo_anio, o.periodo_mes, o.observacion,
            c.codigo AS concepto_codigo, c.nombre AS concepto_nombre
     FROM pago_detalles pd
     JOIN obligaciones o ON o.id = pd.obligacion_id
     JOIN conceptos_cobro c ON c.id = o.concepto_id
     WHERE pd.pago_id = ?
     ORDER BY o.periodo_anio, o.periodo_mes`,
    [id]
  );
  return { ...filas[0], detalles };
}

async function listarEgresos(conexion, { proveedor, desde, hasta }) {
  const condiciones = [];
  const params = [];
  if (proveedor) { condiciones.push('e.proveedor LIKE ?'); params.push(`%${proveedor}%`); }
  if (desde) { condiciones.push('e.fecha >= ?'); params.push(desde); }
  if (hasta) { condiciones.push('e.fecha <= ?'); params.push(hasta); }
  const [filas] = await conexion.query(
    `SELECT e.*, e.proveedor AS proveedor_nombre, e.ruc_proveedor AS proveedor_ruc,
            CONCAT(reg.nombres, ' ', reg.apellidos) AS registrado_por_usuario
     FROM egresos e
     LEFT JOIN cuentas c ON c.id = e.registrado_por_cuenta_id
     LEFT JOIN personas reg ON reg.id = c.persona_id
     ${where(condiciones)}
     ORDER BY e.fecha DESC, e.id DESC`,
    params
  );
  return filas;
}

/**
 * Balance: ingresos (pagos vigentes) y egresos del período, cartera pendiente a la fecha,
 * resumen mensual del período (o de los últimos 12 meses) y cartera por concepto.
 */
async function balance(conexion, { desde, hasta }) {
  const fin = hasta || hoy();
  const inicioResumen = desde || `${Number(fin.slice(0, 4)) - 1}-${fin.slice(5, 7)}-01`;

  const filtroPagos = ["estado = 'VIGENTE'"];
  const pIngresos = [];
  filtroFechaPago('fecha_pago', { desde, hasta }, filtroPagos, pIngresos);
  const filtroEgresos = [];
  const pEgresos = [];
  if (desde) { filtroEgresos.push('fecha >= ?'); pEgresos.push(desde); }
  if (hasta) { filtroEgresos.push('fecha <= ?'); pEgresos.push(hasta); }

  const [[{ totalIngresos }]] = await conexion.query(
    `SELECT COALESCE(SUM(valor_total), 0) AS totalIngresos FROM pagos ${where(filtroPagos)}`, pIngresos
  );
  const [[{ totalEgresos }]] = await conexion.query(
    `SELECT COALESCE(SUM(valor), 0) AS totalEgresos FROM egresos ${where(filtroEgresos)}`, pEgresos
  );
  const [[cartera]] = await conexion.query(
    `SELECT COALESCE(SUM(valor), 0) AS totalPendientes,
            COALESCE(SUM(CASE WHEN fecha_vencimiento IS NOT NULL AND fecha_vencimiento < ? THEN valor END), 0) AS totalVencido,
            COUNT(DISTINCT persona_id) AS comunerosConDeuda
     FROM obligaciones WHERE estado = 'PENDIENTE'`,
    [hoy()]
  );
  // El mes de un pago es el de Ecuador, no el de UTC.
  const [resumenMensual] = await conexion.query(
    `SELECT mes, SUM(ingresos) AS ingresos, SUM(egresos) AS egresos FROM (
       SELECT DATE_FORMAT(CONVERT_TZ(fecha_pago, '+00:00', ?), '%Y-%m') AS mes, valor_total AS ingresos, 0 AS egresos
       FROM pagos WHERE estado = 'VIGENTE' AND fecha_pago >= ? AND fecha_pago < ?
       UNION ALL
       SELECT DATE_FORMAT(fecha, '%Y-%m') AS mes, 0, valor FROM egresos WHERE fecha >= ? AND fecha <= ?
     ) t GROUP BY mes ORDER BY mes DESC`,
    [ZONA_MYSQL, inicioDelDiaUtc(inicioResumen), finDelDiaUtc(fin), inicioResumen, fin]
  );
  const [carteraPorConcepto] = await conexion.query(
    `SELECT c.codigo, c.nombre, COUNT(*) AS obligaciones, SUM(o.valor) AS total
     FROM obligaciones o JOIN conceptos_cobro c ON c.id = o.concepto_id
     WHERE o.estado = 'PENDIENTE' GROUP BY c.id ORDER BY total DESC`
  );

  return {
    balance: {
      totalIngresos: Number(totalIngresos),
      totalEgresos: Number(totalEgresos),
      totalPendientes: Number(cartera.totalPendientes),
      totalVencido: Number(cartera.totalVencido),
      comunerosConDeuda: Number(cartera.comunerosConDeuda),
      balanceAlDia: restarMontos(totalIngresos, totalEgresos),
      desde: desde ?? null,
      hasta: hasta ?? null,
      fechaReporte: new Date().toISOString()
    },
    resumenMensual: resumenMensual.map((m) => ({ mes: m.mes, ingresos: Number(m.ingresos), egresos: Number(m.egresos) })),
    carteraPorConcepto: carteraPorConcepto.map((c) => ({ ...c, total: Number(c.total) }))
  };
}

/** Suma ingresos y egresos de un nodo (mes, año o total) en centavos y devuelve dólares con su balance. */
function totales(nodos) {
  const ingresos = nodos.reduce((s, n) => s + aCentavos(n.ingresos), 0);
  const egresos = nodos.reduce((s, n) => s + aCentavos(n.egresos), 0);
  return { ingresos: aDolares(ingresos), egresos: aDolares(egresos), balance: aDolares(ingresos - egresos) };
}

/**
 * Historial financiero anual: años → meses con ingresos (pagos vigentes, por mes de Ecuador),
 * egresos y balance. Los totales y balances se calculan aquí, en centavos, para que el
 * frontend solo los muestre. Años y meses van del más reciente al más antiguo.
 */
async function historialAnual(conexion) {
  const [filas] = await conexion.query(
    `SELECT mes, SUM(ingresos) AS ingresos, SUM(egresos) AS egresos,
            SUM(es_pago) AS pagos, SUM(1 - es_pago) AS registrosEgreso
     FROM (
       SELECT DATE_FORMAT(CONVERT_TZ(fecha_pago, '+00:00', ?), '%Y-%m') AS mes, valor_total AS ingresos, 0 AS egresos, 1 AS es_pago
       FROM pagos WHERE estado = 'VIGENTE'
       UNION ALL
       SELECT DATE_FORMAT(fecha, '%Y-%m'), 0, valor, 0 FROM egresos
     ) t GROUP BY mes ORDER BY mes DESC`,
    [ZONA_MYSQL]
  );

  const anios = new Map();
  for (const f of filas) {
    const anio = Number(f.mes.slice(0, 4));
    if (!anios.has(anio)) anios.set(anio, []);
    anios.get(anio).push({
      mes: f.mes,
      ...totales([f]),
      pagos: Number(f.pagos),
      egresosRegistrados: Number(f.registrosEgreso)
    });
  }
  const resultado = [...anios].map(([anio, meses]) => ({ anio, ...totales(meses), meses }));
  return { anios: resultado, total: totales(resultado) };
}

module.exports = {
  filtroFechaPago, listarConceptos, listarTarifas, listarObligaciones, obligacionesPorCedula, periodosObligaciones,
  listarPagos, detallePago, listarEgresos, balance, historialAnual
};
