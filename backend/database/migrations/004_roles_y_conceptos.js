// Concepto de cobro para los turnos adicionales de riego (antes se creaba al vuelo).
// El sistema maneja solo dos roles, ADMIN y USUARIO, sembrados en la migración 001.
module.exports.up = async (db) => {
  await db.query(`INSERT INTO conceptos_cobro (codigo, nombre, descripcion) VALUES
    ('TURNO_ADICIONAL', 'Turno Adicional de Agua', 'Cobro por asignación de turno adicional de riego')
    ON DUPLICATE KEY UPDATE nombre = VALUES(nombre)`);
};
