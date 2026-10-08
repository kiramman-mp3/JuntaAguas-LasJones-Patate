// Las convocatorias se publican en un grupo de WhatsApp en lugar de enviarse a cada comunero:
// - configuracion guarda el grupo elegido desde el panel (y futuros ajustes clave/valor),
// - envios_convocatoria registra envíos a un grupo (sin persona) y quién los hizo.
// Es reejecutable: cada cambio comprueba antes si ya está aplicado.
module.exports.up = async (db, { addColumnIfMissing }) => {
  await db.query(`CREATE TABLE IF NOT EXISTS configuracion (
    clave VARCHAR(100) PRIMARY KEY,
    valor TEXT NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    updated_by_cuenta_id BIGINT NULL,
    FOREIGN KEY (updated_by_cuenta_id) REFERENCES cuentas(id) ON DELETE SET NULL
  ) ENGINE=InnoDB COMMENT='Ajustes generales del sistema (clave/valor)'`);

  await db.query('ALTER TABLE envios_convocatoria MODIFY persona_id BIGINT NULL');
  await addColumnIfMissing(db, 'envios_convocatoria', 'destino_nombre', 'VARCHAR(150) NULL AFTER destino');
  await addColumnIfMissing(db, 'envios_convocatoria', 'enviado_por_cuenta_id', 'BIGINT NULL');

  const [fk] = await db.query(
    "SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'envios_convocatoria' AND CONSTRAINT_NAME = 'fk_envios_enviado_por'"
  );
  if (!fk.length) {
    await db.query(
      'ALTER TABLE envios_convocatoria ADD CONSTRAINT fk_envios_enviado_por FOREIGN KEY (enviado_por_cuenta_id) REFERENCES cuentas(id) ON DELETE SET NULL'
    );
  }
};
