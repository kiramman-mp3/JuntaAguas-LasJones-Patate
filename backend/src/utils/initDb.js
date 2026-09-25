const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

/**
 * Script utilitario para conectar a MySQL e inicializar las tablas y datos semilla
 */
async function inicializarBaseDeDatos() {
  console.log('[DB Init] Conectando al servidor MySQL...');

    const host = process.env.DB_HOST || '127.0.0.1';
    const port = parseInt(process.env.DB_PORT || '3306');
    const user = process.env.DB_USER || 'root';
    const password = process.env.DB_PASSWORD || '';
    const database = process.env.DB_NAME || 'junta_las_jones';

    let connection;

    try {
      // 1. Conectar al servidor MySQL (sin especificar la base de datos inicialmente)
      connection = await mysql.createConnection({
        host,
        port,
        user,
        password,
        multipleStatements: true
      });


    console.log(`[DB Init] Conexión establecida con MySQL en ${host}.`);

    // 2. Crear la base de datos si no existe y seleccionarla
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    await connection.query(`USE \`${database}\`;`);
    console.log(`[DB Init] Base de datos '${database}' lista para inicialización.`);

    // 3. Cargar el script SQL desde backend/database/schema.sql
    const schemaPath = path.join(__dirname, '../../database/schema.sql');
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`No se encontró el archivo SQL en: ${schemaPath}`);
    }

    const sqlScript = fs.readFileSync(schemaPath, 'utf8');
    console.log(`[DB Init] Ejecutando el script SQL desde ${schemaPath}...`);

    // 4. Ejecutar el script SQL completo
    await connection.query(sqlScript);

    console.log('----------------------------------------------------------------------');
    console.log(`✅ [DB Init] ¡ÉXITO! La base de datos '${database}' ha sido inicializada.`);
    console.log('   - 25 tablas relacionales creadas y estructuradas.');
    console.log('   - Claves foráneas, índices y restricciones aplicadas.');
    console.log('   - Datos semilla para Roles, Cargos y Conceptos insertados.');
    console.log('----------------------------------------------------------------------');

  } catch (error) {
    console.error('❌ [DB Init Error] Falló la inicialización de la base de datos:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('[DB Init] Conexión MySQL cerrada.');
    }
  }
}

// Ejecutar si se invoca directamente desde la terminal
if (require.main === module) {
  inicializarBaseDeDatos();
}

module.exports = { inicializarBaseDeDatos };
