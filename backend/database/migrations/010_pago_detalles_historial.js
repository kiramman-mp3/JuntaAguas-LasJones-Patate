// Al anular un pago se borraban sus detalles para poder volver a cobrar la obligación,
// perdiendo qué obligaciones cubría. Se quita la unicidad global por obligación: la regla
// "una obligación se paga una sola vez" la garantiza el estado PENDIENTE/PAGADA bajo bloqueo.
module.exports.up = async (db, { addIndexIfMissing }) => {
  const [indices] = await db.query(
    "SELECT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pago_detalles' AND INDEX_NAME = 'obligacion_id'"
  );
  if (indices.length) {
    await addIndexIfMissing(db, 'pago_detalles', 'idx_pago_detalles_obligacion', '(obligacion_id)');
    await db.query('ALTER TABLE pago_detalles DROP INDEX obligacion_id');
  }
};
