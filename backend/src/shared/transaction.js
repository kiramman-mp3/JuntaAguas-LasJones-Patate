const db = require('../config/db');

/**
 * Ejecuta `operacion(connection)` dentro de una transacción.
 * Hace commit si termina bien y rollback ante cualquier error, liberando siempre la conexión.
 */
async function withTransaction(operacion) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const resultado = await operacion(connection);
    await connection.commit();
    return resultado;
  } catch (error) {
    await connection.rollback().catch(() => {});
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = { withTransaction };
