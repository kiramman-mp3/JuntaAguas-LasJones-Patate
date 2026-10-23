// Permite asociar una minga a un sector geográfico específico (o NULL para "Todos los sectores").
module.exports.up = async (db, { addColumnIfMissing, addIndexIfMissing }) => {
  await addColumnIfMissing(db, 'eventos', 'sector_id', 'BIGINT NULL AFTER lugar');
  await addIndexIfMissing(db, 'eventos', 'idx_eventos_sector', '(sector_id)');

  const [fk] = await db.query(
    "SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'eventos' AND CONSTRAINT_NAME = 'fk_eventos_sector'"
  );
  if (!fk.length) {
    await db.query(
      'ALTER TABLE eventos ADD CONSTRAINT fk_eventos_sector FOREIGN KEY (sector_id) REFERENCES sectores(id) ON DELETE SET NULL'
    );
  }
};
