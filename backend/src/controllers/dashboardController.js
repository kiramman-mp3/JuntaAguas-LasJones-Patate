const db = require('../config/db');
const { hoy, inicioDelDiaUtc } = require('../shared/dates');

/**
 * Indicadores del panel de administración, calculados con datos reales.
 * Los montos del mes y del año usan el calendario de Ecuador.
 */
async function getResumen(req, res) {
  const fecha = hoy();
  const inicioMes = `${fecha.slice(0, 7)}-01`;
  const inicioAnio = `${fecha.slice(0, 4)}-01-01`;

  const [[comunidad]] = await db.query(
    `SELECT (SELECT COUNT(*) FROM personas WHERE estado = 'ACTIVO') AS comunerosActivos,
            (SELECT COUNT(*) FROM lotes WHERE activo = TRUE) AS lotes,
            (SELECT COUNT(*) FROM sectores WHERE activo = TRUE) AS sectores,
            (SELECT COUNT(*) FROM turnos_riego WHERE estado = 'ACTIVO') AS turnosActivos,
            (SELECT COUNT(*) FROM cuentas WHERE estado = 'ACTIVA') AS cuentasActivas`
  );

  const [[finanzas]] = await db.query(
    `SELECT
       (SELECT COALESCE(SUM(valor_total), 0) FROM pagos WHERE estado = 'VIGENTE' AND fecha_pago >= ?) AS recaudadoMes,
       (SELECT COALESCE(SUM(valor_total), 0) FROM pagos WHERE estado = 'VIGENTE' AND fecha_pago >= ?) AS recaudadoAnio,
       (SELECT COALESCE(SUM(valor), 0) FROM egresos WHERE fecha >= ?) AS egresosMes,
       (SELECT COALESCE(SUM(valor), 0) FROM egresos WHERE fecha >= ?) AS egresosAnio,
       (SELECT COALESCE(SUM(valor_total), 0) FROM pagos WHERE estado = 'VIGENTE') -
         (SELECT COALESCE(SUM(valor), 0) FROM egresos) AS saldoCaja,
       (SELECT COALESCE(SUM(valor), 0) FROM obligaciones WHERE estado = 'PENDIENTE') AS carteraPendiente,
       (SELECT COALESCE(SUM(valor), 0) FROM obligaciones WHERE estado = 'PENDIENTE' AND fecha_vencimiento < ?) AS carteraVencida,
       (SELECT COUNT(DISTINCT persona_id) FROM obligaciones WHERE estado = 'PENDIENTE' AND fecha_vencimiento < ?) AS comunerosEnMora`,
    // fecha_pago está en UTC: el mes de Ecuador empieza a las 05:00 UTC del día 1.
    [inicioDelDiaUtc(inicioMes), inicioDelDiaUtc(inicioAnio), inicioMes, inicioAnio, fecha, fecha]
  );

  // Eficiencia de cobro de las cuotas de agua emitidas este año.
  const [[cobranza]] = await db.query(
    `SELECT COALESCE(SUM(o.valor), 0) AS emitido, COALESCE(SUM(CASE WHEN o.estado = 'PAGADA' THEN o.valor END), 0) AS cobrado
     FROM obligaciones o JOIN conceptos_cobro c ON c.id = o.concepto_id
     WHERE c.codigo = 'AGUA_MENSUAL' AND o.estado <> 'ANULADA' AND o.periodo_anio = ?`,
    [Number(fecha.slice(0, 4))]
  );

  const [ultimosEventos] = await db.query(
    `SELECT e.id, e.tipo, e.titulo, e.fecha,
            SUM(a.estado = 'PRESENTE') AS presentes, COUNT(a.id) AS registrados
     FROM eventos e JOIN asistencias a ON a.evento_id = e.id
     WHERE e.estado = 'REALIZADO'
     GROUP BY e.id ORDER BY e.fecha DESC LIMIT 6`
  );
  const asistenciaPromedio = ultimosEventos.length
    ? ultimosEventos.reduce((suma, e) => suma + Number(e.presentes) / Number(e.registrados), 0) / ultimosEventos.length
    : null;

  const [proximosEventos] = await db.query(
    `SELECT id, tipo, titulo, fecha, hora_inicio, lugar, estado FROM eventos
     WHERE estado IN ('BORRADOR', 'PROGRAMADO', 'CONVOCADO') AND fecha >= ?
     ORDER BY fecha, hora_inicio LIMIT 5`,
    [fecha]
  );

  const [[{ eventosAnio }]] = await db.query(
    "SELECT COUNT(*) AS eventosAnio FROM eventos WHERE estado <> 'CANCELADO' AND fecha >= ?", [inicioAnio]
  );

  const numero = (v) => Number(v ?? 0);
  return res.json({
    status: 'OK',
    data: {
      fecha,
      comunidad: { ...Object.fromEntries(Object.entries(comunidad).map(([k, v]) => [k, numero(v)])), eventosAnio: numero(eventosAnio) },
      finanzas: Object.fromEntries(Object.entries(finanzas).map(([k, v]) => [k, numero(v)])),
      cobranza: {
        emitido: numero(cobranza.emitido),
        cobrado: numero(cobranza.cobrado),
        porcentaje: numero(cobranza.emitido) ? numero(cobranza.cobrado) / numero(cobranza.emitido) : null
      },
      asistencia: {
        promedio: asistenciaPromedio,
        ultimosEventos: ultimosEventos.map((e) => ({ ...e, presentes: numero(e.presentes), registrados: numero(e.registrados) }))
      },
      proximosEventos
    }
  });
}

module.exports = { getResumen };
