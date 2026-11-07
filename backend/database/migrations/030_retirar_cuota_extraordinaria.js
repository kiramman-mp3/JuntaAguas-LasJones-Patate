// La cuota extraordinaria nunca tuvo pantalla ni se cobró: se retira del catálogo de conceptos.
// Si algún entorno llegó a emitir una obligación con ese concepto, solo se desactiva para no perder su historial.
module.exports.up = async (db) => {
  const [[{ usos }]] = await db.query(
    `SELECT COUNT(*) AS usos
     FROM obligaciones o JOIN conceptos_cobro c ON c.id = o.concepto_id
     WHERE c.codigo = 'CUOTA_EXTRAORDINARIA'`
  );
  if (usos > 0) {
    await db.query("UPDATE conceptos_cobro SET activo = FALSE WHERE codigo = 'CUOTA_EXTRAORDINARIA'");
    return;
  }
  await db.query(
    `DELETE t FROM tarifas t JOIN conceptos_cobro c ON c.id = t.concepto_id
     WHERE c.codigo = 'CUOTA_EXTRAORDINARIA'`
  );
  await db.query("DELETE FROM conceptos_cobro WHERE codigo = 'CUOTA_EXTRAORDINARIA'");
};
