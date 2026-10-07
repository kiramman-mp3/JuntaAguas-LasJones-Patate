// La anulación de pagos se marcaba con el texto "[ANULADO:" dentro de la observación.
// Se reemplaza por columnas explícitas y se migran los pagos ya anulados.
module.exports.up = async (db, { addColumnIfMissing, addIndexIfMissing }) => {
  await addColumnIfMissing(db, 'pagos', 'estado', "ENUM('VIGENTE', 'ANULADO') NOT NULL DEFAULT 'VIGENTE' AFTER referencia");
  await addColumnIfMissing(db, 'pagos', 'anulado_por_cuenta_id', 'BIGINT NULL');
  await addColumnIfMissing(db, 'pagos', 'fecha_anulacion', 'DATETIME NULL');
  await addColumnIfMissing(db, 'pagos', 'motivo_anulacion', 'VARCHAR(255) NULL');
  await addIndexIfMissing(db, 'pagos', 'idx_pagos_estado_fecha', '(estado, fecha_pago)');

  const [anulados] = await db.query("SELECT id, observacion FROM pagos WHERE estado = 'VIGENTE' AND observacion LIKE '%[ANULADO:%'");
  for (const pago of anulados) {
    const [, original = '', motivo = ''] = pago.observacion.match(/^(.*?)\s*\[ANULADO:\s*(.*?)\]\s*$/s) || [];
    await db.query(
      "UPDATE pagos SET estado = 'ANULADO', motivo_anulacion = ?, observacion = ? WHERE id = ?",
      [motivo.slice(0, 255) || 'Anulación migrada', original.trim() || null, pago.id]
    );
  }

  const [fk] = await db.query(`SELECT 1 FROM information_schema.REFERENTIAL_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'fk_pagos_anulado_por'`);
  if (!fk.length) {
    await db.query(`ALTER TABLE pagos ADD CONSTRAINT fk_pagos_anulado_por
      FOREIGN KEY (anulado_por_cuenta_id) REFERENCES cuentas(id) ON DELETE SET NULL`);
  }
};
