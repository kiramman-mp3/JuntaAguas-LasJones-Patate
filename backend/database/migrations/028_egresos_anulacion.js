// Migración: Permitir anulación de egresos con motivo y auditoría (H-02)
module.exports.up = async (db, { addColumnIfMissing, addIndexIfMissing }) => {
  await addColumnIfMissing(db, 'egresos', 'estado', "ENUM('VIGENTE', 'ANULADO') NOT NULL DEFAULT 'VIGENTE'");
  await addColumnIfMissing(db, 'egresos', 'motivo_anulacion', 'VARCHAR(255) NULL');
  await addColumnIfMissing(db, 'egresos', 'fecha_anulacion', 'DATETIME NULL');
  await addColumnIfMissing(db, 'egresos', 'anulado_por_cuenta_id', 'BIGINT NULL');

  await addIndexIfMissing(db, 'egresos', 'idx_egresos_estado', '(estado)');

  const [fk] = await db.query(
    `SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'egresos' AND CONSTRAINT_NAME = 'fk_egresos_anulado_por'`
  );
  if (!fk.length) {
    await db.query(
      'ALTER TABLE egresos ADD CONSTRAINT fk_egresos_anulado_por FOREIGN KEY (anulado_por_cuenta_id) REFERENCES cuentas(id) ON DELETE SET NULL'
    );
  }
};
