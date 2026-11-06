// Migración: Asignar cada obligación anual de agua a un lote específico
// En lugar de una cuota plana por persona, se emite una cuota por cada lote que posea el usuario.
module.exports.up = async (db, { addColumnIfMissing, addIndexIfMissing, addUniqueIfMissing }) => {
  await addColumnIfMissing(db, 'obligacion_anual_agua', 'lote_id', 'BIGINT NULL');

  // Asignar el lote correspondiente según el titular histórico o actual
  await db.query(`
    UPDATE obligacion_anual_agua o
    JOIN (
      SELECT pl.persona_id, MIN(pl.lote_id) AS lote_id
      FROM persona_lotes pl
      GROUP BY pl.persona_id
    ) pl ON pl.persona_id = o.persona_id
    SET o.lote_id = pl.lote_id
    WHERE o.lote_id IS NULL
  `);

  // Para cualquier registro que quede sin lote, asignar el primer lote disponible
  await db.query(`
    UPDATE obligacion_anual_agua o
    SET o.lote_id = (SELECT MIN(id) FROM lotes)
    WHERE o.lote_id IS NULL
  `);

  // Asegurar llave foránea hacia lotes
  const [fk] = await db.query(
    `SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'obligacion_anual_agua' AND CONSTRAINT_NAME = 'fk_obligacion_anual_lote'`
  );
  if (!fk.length) {
    await db.query(
      'ALTER TABLE obligacion_anual_agua ADD CONSTRAINT fk_obligacion_anual_lote FOREIGN KEY (lote_id) REFERENCES lotes(id) ON DELETE CASCADE'
    );
  }

  // El índice único anterior uq_obligacion_anual_persona_anio puede estar respaldando
  // la clave foránea hacia personas(id). Si es así, MySQL no permite eliminar el índice
  // sin antes desligar o recrear la restricción de clave foránea.
  const [fkPersonaRows] = await db.query(`
    SELECT CONSTRAINT_NAME
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'obligacion_anual_agua'
      AND COLUMN_NAME = 'persona_id'
      AND REFERENCED_TABLE_NAME = 'personas'
  `);
  for (const row of fkPersonaRows) {
    await db.query(`ALTER TABLE obligacion_anual_agua DROP FOREIGN KEY \`${row.CONSTRAINT_NAME}\``);
  }

  // Eliminar restricción única anterior (persona_id, periodo_anio) si existe
  const [uqViejo] = await db.query(
    `SELECT 1 FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'obligacion_anual_agua' AND INDEX_NAME = 'uq_obligacion_anual_persona_anio'`
  );
  if (uqViejo.length) {
    await db.query('ALTER TABLE obligacion_anual_agua DROP INDEX uq_obligacion_anual_persona_anio');
  }

  // Crear índice simple en persona_id y restaurar la clave foránea hacia personas
  await addIndexIfMissing(db, 'obligacion_anual_agua', 'idx_obligacion_anual_persona', '(persona_id)');
  const [fkPersonaRestaurada] = await db.query(`
    SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'obligacion_anual_agua' AND CONSTRAINT_NAME = 'fk_obligacion_anual_persona'
  `);
  if (!fkPersonaRestaurada.length) {
    await db.query(
      'ALTER TABLE obligacion_anual_agua ADD CONSTRAINT fk_obligacion_anual_persona FOREIGN KEY (persona_id) REFERENCES personas(id) ON DELETE CASCADE'
    );
  }

  // Crear índice único por lote y año: cada lote tiene una sola obligación anual por año
  await addUniqueIfMissing(db, 'obligacion_anual_agua', 'uq_obligacion_anual_lote_anio', '(lote_id, periodo_anio)');
  // Mantener índice para consultas de deudas por persona y año
  await addIndexIfMissing(db, 'obligacion_anual_agua', 'idx_obligacion_anual_persona_anio', '(persona_id, periodo_anio)');
};
