// Gestión del pago anual de agua igual que la de los demás pagos:
// - obligacion_anual_agua usa los mismos estados que obligaciones (PENDIENTE, PAGADA, ANULADA);
// - pago_anual_agua puede anularse (estado, motivo, fecha y quién lo anuló) y conserva su detalle;
// - el detalle guarda el valor cobrado y deja de ser único por obligación, porque tras anular
//   un pago la obligación vuelve a PENDIENTE y puede cobrarse de nuevo (el bloqueo FOR UPDATE y
//   el estado de la obligación impiden cobrarla dos veces a la vez).
module.exports.up = async (db, { addColumnIfMissing, addIndexIfMissing }) => {
  await db.query("ALTER TABLE obligacion_anual_agua MODIFY estado ENUM('PENDIENTE', 'PAGADO', 'PAGADA', 'ANULADA') NOT NULL DEFAULT 'PENDIENTE'");
  await db.query("UPDATE obligacion_anual_agua SET estado = 'PAGADA' WHERE estado = 'PAGADO'");
  await db.query("ALTER TABLE obligacion_anual_agua MODIFY estado ENUM('PENDIENTE', 'PAGADA', 'ANULADA') NOT NULL DEFAULT 'PENDIENTE'");
  await addColumnIfMissing(db, 'obligacion_anual_agua', 'motivo_anulacion', 'VARCHAR(255) NULL');
  await addColumnIfMissing(db, 'obligacion_anual_agua', 'fecha_anulacion', 'DATETIME NULL');
  await addColumnIfMissing(db, 'obligacion_anual_agua', 'anulada_por_cuenta_id', 'BIGINT NULL');

  await addColumnIfMissing(db, 'pago_anual_agua', 'estado', "ENUM('VIGENTE', 'ANULADO') NOT NULL DEFAULT 'VIGENTE'");
  await addColumnIfMissing(db, 'pago_anual_agua', 'motivo_anulacion', 'VARCHAR(255) NULL');
  await addColumnIfMissing(db, 'pago_anual_agua', 'fecha_anulacion', 'DATETIME NULL');
  await addColumnIfMissing(db, 'pago_anual_agua', 'anulado_por_cuenta_id', 'BIGINT NULL');
  await addIndexIfMissing(db, 'pago_anual_agua', 'idx_pago_anual_estado', '(estado, fecha_pago)');

  await addColumnIfMissing(db, 'pago_anual_agua_detalle', 'valor_pagado', 'DECIMAL(12, 2) NULL');
  await db.query(
    `UPDATE pago_anual_agua_detalle d JOIN obligacion_anual_agua o ON o.id = d.obligacion_anual_agua
     SET d.valor_pagado = o.valor_total WHERE d.valor_pagado IS NULL`
  );
  await db.query('ALTER TABLE pago_anual_agua_detalle MODIFY valor_pagado DECIMAL(12, 2) NOT NULL');

  // El índice único también sostenía la clave foránea: se crea el índice simple antes de quitarlo.
  await addIndexIfMissing(db, 'pago_anual_agua_detalle', 'idx_pago_anual_detalle_obligacion', '(obligacion_anual_agua)');
  const [unico] = await db.query(
    `SELECT 1 FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pago_anual_agua_detalle' AND INDEX_NAME = 'uq_pago_anual_detalle_obligacion'`
  );
  if (unico.length) await db.query('ALTER TABLE pago_anual_agua_detalle DROP INDEX uq_pago_anual_detalle_obligacion');

  for (const [tabla, columna, nombre] of [
    ['pago_anual_agua', 'anulado_por_cuenta_id', 'fk_pago_anual_anulado_por'],
    ['obligacion_anual_agua', 'anulada_por_cuenta_id', 'fk_obligacion_anual_anulada_por']
  ]) {
    const [fk] = await db.query(
      'SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?',
      [tabla, nombre]
    );
    if (!fk.length) {
      await db.query(`ALTER TABLE \`${tabla}\` ADD CONSTRAINT \`${nombre}\` FOREIGN KEY (\`${columna}\`) REFERENCES cuentas(id) ON DELETE SET NULL`);
    }
  }
};
