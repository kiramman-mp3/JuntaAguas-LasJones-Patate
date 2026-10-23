// Cada asamblea tiene una sola acta general (documentos_evento, tipo ACTA). Las actas por punto
// de la migración 003 ya no existen en la API ni en la interfaz, así que se eliminan sus columnas.
// Las actas firmadas por punto se descartan: la URL del archivo solo vivía en estas columnas.
module.exports.up = async (db, { dropColumnIfExists }) => {
  for (const columna of ['titulo_acta', 'estado_acta', 'acta_firmada_url', 'acta_firmada_nombre', 'responsables', 'fecha_acta']) {
    await dropColumnIfExists(db, 'puntos_asamblea', columna);
  }
};
