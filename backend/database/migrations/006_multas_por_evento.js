// Las multas se identifican por evento. Con periodo_mes informado, la clave única de cuotas
// (persona, concepto, año, mes) descartaba la multa de una segunda asamblea en el mismo mes.
module.exports.up = async (db) => {
  await db.query(`UPDATE obligaciones SET periodo_mes = NULL
    WHERE evento_id IS NOT NULL AND origen = 'AUTOMATICA' AND periodo_mes IS NOT NULL`);
};
