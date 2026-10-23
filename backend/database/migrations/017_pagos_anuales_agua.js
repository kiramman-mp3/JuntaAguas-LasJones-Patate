// Pago único anual de agua: una obligación por usuario y año, y un pago (cabecera + detalle) que
// cubre una o varias obligaciones. Es reejecutable y también ajusta las tablas creadas a mano
// con el script inicial (sin unicidad ni registro de quién cobró).
module.exports.up = async (db, { addColumnIfMissing, addIndexIfMissing, addUniqueIfMissing }) => {
  await db.query(`CREATE TABLE IF NOT EXISTS obligacion_anual_agua (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    persona_id BIGINT NOT NULL,
    periodo_anio SMALLINT NOT NULL,
    valor_total DECIMAL(12, 2) NOT NULL,
    estado ENUM('PENDIENTE', 'PAGADO') NOT NULL DEFAULT 'PENDIENTE',
    FOREIGN KEY (persona_id) REFERENCES personas(id) ON DELETE CASCADE
  ) ENGINE=InnoDB COMMENT='Pago único anual de agua por usuario'`);

  await db.query(`CREATE TABLE IF NOT EXISTS pago_anual_agua (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    persona_id BIGINT NOT NULL,
    valor_total DECIMAL(12, 2) NOT NULL,
    metodo ENUM('TRANSFERENCIA', 'DEPOSITO') NOT NULL DEFAULT 'TRANSFERENCIA',
    referencia VARCHAR(100) NULL,
    observacion VARCHAR(255) NULL,
    fecha_pago DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (persona_id) REFERENCES personas(id) ON DELETE CASCADE
  ) ENGINE=InnoDB COMMENT='Cabecera del pago anual de agua'`);

  await db.query(`CREATE TABLE IF NOT EXISTS pago_anual_agua_detalle (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    pago_anual_agua_id BIGINT NOT NULL,
    obligacion_anual_agua BIGINT NOT NULL,
    FOREIGN KEY (pago_anual_agua_id) REFERENCES pago_anual_agua(id) ON DELETE CASCADE,
    FOREIGN KEY (obligacion_anual_agua) REFERENCES obligacion_anual_agua(id) ON DELETE CASCADE
  ) ENGINE=InnoDB COMMENT='Obligaciones cubiertas por un pago anual de agua'`);

  // Un usuario solo puede tener una obligación por año. Se descartan las repetidas sin pagar.
  await db.query(`DELETE o FROM obligacion_anual_agua o
    JOIN obligacion_anual_agua previa
      ON previa.persona_id = o.persona_id AND previa.periodo_anio = o.periodo_anio AND previa.id < o.id
    WHERE o.estado = 'PENDIENTE'`);
  await db.query('ALTER TABLE obligacion_anual_agua MODIFY periodo_anio SMALLINT NOT NULL');
  await addUniqueIfMissing(db, 'obligacion_anual_agua', 'uq_obligacion_anual_persona_anio', '(persona_id, periodo_anio)');

  // Una obligación se paga una sola vez.
  await addUniqueIfMissing(db, 'pago_anual_agua_detalle', 'uq_pago_anual_detalle_obligacion', '(obligacion_anual_agua)');

  await addIndexIfMissing(db, 'pago_anual_agua', 'idx_pago_anual_fecha', '(fecha_pago)');
  await addIndexIfMissing(db, 'pago_anual_agua', 'idx_pago_anual_persona', '(persona_id)');

  await addColumnIfMissing(db, 'pago_anual_agua', 'registrado_por_cuenta_id', 'BIGINT NULL');
  const [fk] = await db.query(
    "SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pago_anual_agua' AND CONSTRAINT_NAME = 'fk_pago_anual_registrado_por'"
  );
  if (!fk.length) {
    await db.query(
      'ALTER TABLE pago_anual_agua ADD CONSTRAINT fk_pago_anual_registrado_por FOREIGN KEY (registrado_por_cuenta_id) REFERENCES cuentas(id) ON DELETE SET NULL'
    );
  }
};
