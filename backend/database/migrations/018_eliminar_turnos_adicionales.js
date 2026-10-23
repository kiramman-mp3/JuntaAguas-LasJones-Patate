// La Junta ya no asigna turnos adicionales de agua: todos los turnos son semanales.
// Los turnos adicionales activos se desactivan (quedan como historial), se quita la columna
// tipo y el concepto TURNO_ADICIONAL se desactiva. Sus cobros ya emitidos se conservan.
module.exports.up = async (db, { columnExists, dropColumnIfExists }) => {
  if (await columnExists(db, 'turnos_riego', 'tipo')) {
    await db.query("UPDATE turnos_riego SET estado = 'INACTIVO' WHERE tipo = 'ADICIONAL' AND estado = 'ACTIVO'");
  }
  await dropColumnIfExists(db, 'turnos_riego', 'tipo');
  await db.query("UPDATE conceptos_cobro SET activo = FALSE WHERE codigo = 'TURNO_ADICIONAL'");
};
