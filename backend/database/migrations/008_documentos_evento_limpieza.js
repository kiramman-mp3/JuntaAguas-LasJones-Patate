// contenido_base64 nunca se llenó (los archivos viven en disco) y las listas de asistencia
// "generadas" eran copias del padrón del momento: ahora se generan bajo demanda.
module.exports.up = async (db, { dropColumnIfExists }) => {
  await dropColumnIfExists(db, 'documentos_evento', 'contenido_base64');
  await db.query(`DELETE FROM documentos_evento
    WHERE nombre_archivo = 'Lista_Asistencia_Generada.pdf' AND ruta_archivo_firmado IS NULL`);
};
