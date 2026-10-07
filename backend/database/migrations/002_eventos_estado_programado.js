// Bases creadas antes del fix I8 no tienen el estado PROGRAMADO en eventos.
module.exports.up = async (db) => {
  await db.query(`ALTER TABLE eventos
    MODIFY COLUMN estado ENUM('BORRADOR', 'PROGRAMADO', 'CONVOCADO', 'REALIZADO', 'CANCELADO') NOT NULL DEFAULT 'BORRADOR'`);
};
