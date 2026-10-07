// Bloqueo temporal de cuentas tras intentos fallidos de inicio de sesión.
module.exports.up = async (db, { addColumnIfMissing }) => {
  await addColumnIfMissing(db, 'cuentas', 'intentos_fallidos', 'INT NOT NULL DEFAULT 0');
  await addColumnIfMissing(db, 'cuentas', 'bloqueada_hasta', 'DATETIME NULL');
};
