module.exports.up = async (db) => {
  await db.query(
    "UPDATE roles SET nombre = 'Usuario de Riego' WHERE codigo = 'USUARIO' AND nombre <> 'Usuario de Riego'"
  );

  const comentarios = [
    "ALTER TABLE personas COMMENT = 'Usuarios registrados en la Junta de Agua'",
    "ALTER TABLE persona_lotes COMMENT = 'Titularidad única de lotes por usuario (1 terreno = 1 dueño)'",
    "ALTER TABLE turnos_riego COMMENT = 'Horarios asignados de agua de riego por usuario y lote'",
    "ALTER TABLE obligaciones COMMENT = 'Cuentas por cobrar pendientes por usuario (pago completo únicamente)'",
    "ALTER TABLE pagos COMMENT = 'Transacciones de pago realizadas por usuarios'"
  ];

  for (const sql of comentarios) {
    await db.query(sql);
  }
};
