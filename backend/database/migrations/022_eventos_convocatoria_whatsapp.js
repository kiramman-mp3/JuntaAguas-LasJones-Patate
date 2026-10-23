// La convocatoria por WhatsApp de un evento se publica una sola vez. eventos.convocatoria_whatsapp_en
// funciona como reserva atómica: el primer envío la fija con un UPDATE condicional y cualquier otro
// intento (un doble clic, otra pestaña) recibe 409 sin llegar a WhatsApp. Si el envío falla se libera.
module.exports.up = async (db, { addColumnIfMissing }) => {
  await addColumnIfMissing(db, 'eventos', 'convocatoria_whatsapp_en', 'DATETIME NULL');
  await db.query(
    `UPDATE eventos e
     JOIN (SELECT evento_id, MIN(fecha_envio) AS primera FROM envios_convocatoria
           WHERE canal = 'WHATSAPP' AND persona_id IS NULL AND estado = 'ENVIADO' GROUP BY evento_id) env
       ON env.evento_id = e.id
     SET e.convocatoria_whatsapp_en = env.primera
     WHERE e.convocatoria_whatsapp_en IS NULL`
  );
};
