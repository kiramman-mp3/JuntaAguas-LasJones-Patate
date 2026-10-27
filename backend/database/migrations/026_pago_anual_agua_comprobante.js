// Respaldo bancario (PDF/imagen) del pago anual de agua, igual que en pagos de multas y otros cobros.
module.exports.up = async (db, { addColumnIfMissing }) => {
  await addColumnIfMissing(db, 'pago_anual_agua', 'comprobante_url', 'VARCHAR(500) NULL');
};
