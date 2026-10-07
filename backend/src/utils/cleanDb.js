const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

/**
 * Script utilitario para LIMPIAR toda la base de datos (DROP DATABASE)
 */
async function limpiarBaseDeDatos() {
  console.log('[DB Clean] Conectando al servidor MySQL para LIMPIAR la base de datos...');

  const host = process.env.DB_HOST || 'localhost';
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  const database = process.env.DB_NAME || 'junta_las_jones';

  let connection;

  try {
    connection = await mysql.createConnection({
      host,
      user,
      password
    });

    console.log(`[DB Clean] Conexión establecida con MySQL en ${host}.`);
    
    console.log(`[DB Clean] ⚠️  PRECAUCIÓN: Eliminando base de datos '${database}' si existe...`);
    await connection.query(`DROP DATABASE IF EXISTS \`${database}\`;`);
    
    console.log(`✅ [DB Clean] ¡ÉXITO! La base de datos '${database}' ha sido eliminada por completo.`);

  } catch (error) {
    console.error('❌ [DB Clean Error] Falló la eliminación de la base de datos:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('[DB Clean] Conexión MySQL cerrada.');
    }
  }
}

if (require.main === module) {
  limpiarBaseDeDatos();
}

module.exports = { limpiarBaseDeDatos };
