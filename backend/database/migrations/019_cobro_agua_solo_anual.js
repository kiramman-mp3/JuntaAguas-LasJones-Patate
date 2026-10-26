// El agua se cobra una sola vez al año. Se agrega el concepto AGUA_ANUAL (su tarifa vigente al
// 1 de enero es el valor del año), se desactiva la cuota mensual AGUA_MENSUAL (las cuotas ya
// emitidas se conservan y pueden cobrarse) y las obligaciones anuales reciben fechas de emisión
// y vencimiento (31 de diciembre) para calcular la cartera vencida.
// Toda obligación pendiente sin vencimiento (multas, cobros manuales) vence 30 días después de emitida.
// CUOTA_EXTRAORDINARIA queda para los cobros manuales que aprueba la asamblea.
module.exports.up = async (db, { addColumnIfMissing, addIndexIfMissing }) => {
  await db.query(
    `INSERT INTO conceptos_cobro (codigo, nombre, descripcion)
     SELECT 'AGUA_ANUAL', 'Pago anual de agua', 'Cuota única anual por el servicio de agua de riego'
     WHERE NOT EXISTS (SELECT 1 FROM conceptos_cobro WHERE codigo = 'AGUA_ANUAL')`
  );
  await db.query(
    `INSERT INTO conceptos_cobro (codigo, nombre, descripcion)
     SELECT 'CUOTA_EXTRAORDINARIA', 'Cuota extraordinaria', 'Cobro aprobado en asamblea (obras, reposiciones u otros)'
     WHERE NOT EXISTS (SELECT 1 FROM conceptos_cobro WHERE codigo = 'CUOTA_EXTRAORDINARIA')`
  );
  await db.query("UPDATE conceptos_cobro SET activo = FALSE WHERE codigo = 'AGUA_MENSUAL'");

  await addColumnIfMissing(db, 'obligacion_anual_agua', 'fecha_emision', 'DATE NULL');
  await addColumnIfMissing(db, 'obligacion_anual_agua', 'fecha_vencimiento', 'DATE NULL');
  await db.query("UPDATE obligacion_anual_agua SET fecha_emision = MAKEDATE(periodo_anio, 1) WHERE fecha_emision IS NULL");
  await db.query(
    "UPDATE obligacion_anual_agua SET fecha_vencimiento = STR_TO_DATE(CONCAT(periodo_anio, '-12-31'), '%Y-%m-%d') WHERE fecha_vencimiento IS NULL"
  );
  await db.query('ALTER TABLE obligacion_anual_agua MODIFY fecha_emision DATE NOT NULL, MODIFY fecha_vencimiento DATE NOT NULL');
  await addIndexIfMissing(db, 'obligacion_anual_agua', 'idx_obligacion_anual_estado', '(estado, fecha_vencimiento)');

  await db.query(
    "UPDATE obligaciones SET fecha_vencimiento = DATE_ADD(fecha_emision, INTERVAL 30 DAY) WHERE fecha_vencimiento IS NULL AND estado = 'PENDIENTE'"
  );
};
