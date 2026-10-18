module.exports.up = async (db, { addColumnIfMissing }) => {
  await addColumnIfMissing(db, 'asistencias', 'archivo_justificacion_url', 'VARCHAR(500) NULL AFTER motivo_justificacion');
  await addColumnIfMissing(db, 'asistencias', 'archivo_justificacion_nombre', 'VARCHAR(255) NULL AFTER archivo_justificacion_url');
};
