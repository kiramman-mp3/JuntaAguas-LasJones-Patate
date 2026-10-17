// Actualización y organización de sectores oficiales de la Junta:
// - Patate Viejo
// - La Merced
// - San Javier
// Reasigna los lotes y usuarios de sectores previos a los 3 sectores oficiales de Patate.
module.exports.up = async (db) => {
  const sectoresOficiales = [
    {
      nombre: 'Patate Viejo',
      descripcion: 'Sector histórico y canal matriz, tomas de cabecera en Patate Viejo'
    },
    {
      nombre: 'La Merced',
      descripcion: 'Zona centro-norte, distribución intermedia y reservorio La Merced'
    },
    {
      nombre: 'San Javier',
      descripcion: 'Sector bajo y fértil hacia la vega del río Patate'
    }
  ];

  // 1. Asegurar la existencia y activación de los 3 sectores oficiales
  for (const s of sectoresOficiales) {
    await db.query(
      `INSERT INTO sectores (nombre, descripcion, activo)
       VALUES (?, ?, TRUE)
       ON DUPLICATE KEY UPDATE descripcion = VALUES(descripcion), activo = TRUE`,
      [s.nombre, s.descripcion]
    );
  }

  // 2. Obtener los IDs de los 3 sectores oficiales
  const [oficiales] = await db.query(
    "SELECT id, nombre FROM sectores WHERE nombre IN ('Patate Viejo', 'La Merced', 'San Javier')"
  );
  const mapa = Object.fromEntries(oficiales.map((s) => [s.nombre, s.id]));

  const idPatateViejo = mapa['Patate Viejo'];
  const idLaMerced = mapa['La Merced'];
  const idSanJavier = mapa['San Javier'];

  // 3. Reasignar lotes de sectores anteriores a los 3 sectores oficiales
  const [antiguos] = await db.query(
    "SELECT id, nombre FROM sectores WHERE nombre NOT IN ('Patate Viejo', 'La Merced', 'San Javier')"
  );

  for (const s of antiguos) {
    const nombre = (s.nombre || '').toUpperCase();
    let nuevoId;

    if (nombre.includes('BAJA') || nombre.includes('BAJO') || nombre.includes('MERCED')) {
      nuevoId = idLaMerced;
    } else if (nombre.includes('TAMBO') || nombre.includes('CUYES') || nombre.includes('JAVIER')) {
      nuevoId = idSanJavier;
    } else {
      nuevoId = idPatateViejo;
    }

    // Reasignar los lotes (y por ende los comuneros titulares) al nuevo sector
    await db.query('UPDATE lotes SET sector_id = ? WHERE sector_id = ?', [nuevoId, s.id]);

    // Desactivar el sector anterior
    await db.query('UPDATE sectores SET activo = FALSE WHERE id = ?', [s.id]);
  }
};
