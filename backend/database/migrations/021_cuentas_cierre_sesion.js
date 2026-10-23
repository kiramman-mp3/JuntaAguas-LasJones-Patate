// Cierre de sesión en el servidor: los tokens emitidos antes de sesiones_validas_desde dejan de
// valer. Lo fija POST /auth/logout, así cerrar sesión invalida el token aunque alguien lo haya copiado.
module.exports.up = async (db, { addColumnIfMissing }) => {
  await addColumnIfMissing(db, 'cuentas', 'sesiones_validas_desde', 'DATETIME(3) NULL');
};
