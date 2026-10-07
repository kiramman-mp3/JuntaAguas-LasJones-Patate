// Precisión de milisegundos para revocar tokens emitidos antes de un cambio de contraseña,
// incluso si el cambio ocurre en el mismo segundo en que se emitió el token.
module.exports.up = async (db) => {
  await db.query('ALTER TABLE cuentas MODIFY COLUMN password_updated_at DATETIME(3) NULL');
};
