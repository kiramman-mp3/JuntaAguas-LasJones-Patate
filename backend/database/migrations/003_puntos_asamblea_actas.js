// Soporte de múltiples actas por asamblea (F07). Antes se creaban en tiempo de ejecución.
module.exports.up = async (db, { addColumnIfMissing }) => {
  await addColumnIfMissing(db, 'puntos_asamblea', 'titulo_acta', 'VARCHAR(255) NULL');
  await addColumnIfMissing(db, 'puntos_asamblea', 'estado_acta', "ENUM('BORRADOR', 'APROBADA', 'FIRMADA') NOT NULL DEFAULT 'BORRADOR'");
  await addColumnIfMissing(db, 'puntos_asamblea', 'acta_firmada_url', 'VARCHAR(500) NULL');
  await addColumnIfMissing(db, 'puntos_asamblea', 'acta_firmada_nombre', 'VARCHAR(255) NULL');
  await addColumnIfMissing(db, 'puntos_asamblea', 'responsables', 'VARCHAR(255) NULL');
  await addColumnIfMissing(db, 'puntos_asamblea', 'fecha_acta', 'DATETIME NULL');
  await db.query("UPDATE puntos_asamblea SET estado_acta = 'BORRADOR' WHERE estado_acta IS NULL");
};
