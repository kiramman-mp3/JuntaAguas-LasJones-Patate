// Las rutas usan SECRETARIO y TESORERO, pero nunca se sembraron. También el concepto de turno adicional.
module.exports.up = async (db) => {
  await db.query(`INSERT INTO roles (codigo, nombre, descripcion) VALUES
    ('SECRETARIO', 'Secretario/a de la Directiva', 'Gestiona comuneros, lotes, turnos, asambleas, mingas y actas'),
    ('TESORERO', 'Tesorero/a de la Directiva', 'Gestiona cobros, pagos, egresos, tarifas y reportes financieros')
    ON DUPLICATE KEY UPDATE nombre = VALUES(nombre), descripcion = VALUES(descripcion)`);
  await db.query(`INSERT INTO conceptos_cobro (codigo, nombre, descripcion) VALUES
    ('TURNO_ADICIONAL', 'Turno Adicional de Agua', 'Cobro por asignación de turno adicional de riego')
    ON DUPLICATE KEY UPDATE nombre = VALUES(nombre)`);
};
