// Titularidad única: un lote pertenece al 100 % a un solo comunero (ya garantizado por
// UNIQUE(lote_id)). Se normalizan valores antiguos y la base de datos rechaza cualquier
// otro porcentaje, para que la regla no dependa solo de la API.
module.exports.up = async (db) => {
  await db.query('UPDATE persona_lotes SET porcentaje = 100.00 WHERE porcentaje IS NULL OR porcentaje <> 100.00');
  await db.query('ALTER TABLE persona_lotes MODIFY porcentaje DECIMAL(5, 2) NOT NULL DEFAULT 100.00');

  const [restricciones] = await db.query(
    "SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'persona_lotes' AND CONSTRAINT_NAME = 'chk_persona_lotes_porcentaje_total'"
  );
  if (!restricciones.length) {
    await db.query('ALTER TABLE persona_lotes ADD CONSTRAINT chk_persona_lotes_porcentaje_total CHECK (porcentaje = 100.00)');
  }
};
