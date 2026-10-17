// No modifica los métodos de pagos históricos.
module.exports.up = async (db, { addColumnIfMissing }) => {
  await addColumnIfMissing(db, 'pagos', 'comprobante_url', 'VARCHAR(500) NULL');
};
