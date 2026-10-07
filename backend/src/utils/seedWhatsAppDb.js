const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

async function seedWhatsApp() {
  console.log('[WhatsApp Seed] Inicializando base de datos reducida para pruebas de WhatsApp...');

  const host = process.env.DB_HOST || '127.0.0.1';
  const port = parseInt(process.env.DB_PORT || '3306');
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  const database = process.env.DB_NAME || 'junta_las_jones';

  let connection;
  try {
    connection = await mysql.createConnection({
      host,
      port,
      user,
      password,
      multipleStatements: true
    });

    // 1. Recrear Base de Datos desde schema.sql
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    await connection.query(`USE \`${database}\`;`);

    const schemaPath = path.join(__dirname, '../../database/schema.sql');
    const sqlScript = fs.readFileSync(schemaPath, 'utf8');
    await connection.query(sqlScript);

    // Limpiar tablas para tener ambiente limpio de pruebas
    await connection.query('SET FOREIGN_KEY_CHECKS = 0;');
    await connection.query('TRUNCATE TABLE envios_convocatoria;');
    await connection.query('TRUNCATE TABLE obligaciones;');
    await connection.query('TRUNCATE TABLE asistencias;');
    await connection.query('TRUNCATE TABLE eventos;');
    await connection.query('TRUNCATE TABLE persona_lotes;');
    await connection.query('TRUNCATE TABLE lotes;');
    await connection.query('TRUNCATE TABLE cuentas;');
    await connection.query('TRUNCATE TABLE personas;');
    await connection.query('SET FOREIGN_KEY_CHECKS = 1;');

    const [roles] = await connection.query(`SELECT id, codigo FROM roles`);
    const adminRol = roles.find(r => r.codigo === 'ADMIN').id;
    const usuarioRol = roles.find(r => r.codigo === 'USUARIO').id;

    const passwordHash = await bcrypt.hash('123456', 10);

    // 2. Insertar Personas (1 Admin + 2 Comuneros)
    await connection.query(`
      INSERT INTO personas (id, cedula, nombres, apellidos, direccion, telefono, celular, estado) VALUES
      (1, '1801234567', 'Admin', 'Directiva', 'Oficina Central Junta', '0991234567', '0991234567', 'ACTIVO'),
      (2, '1800000001', 'Juan Carlos', 'Morales Soria', 'Sector Las Jones Alto', '0991234567', '0991234567', 'ACTIVO'),
      (3, '1800000002', 'María Elena', 'García Tamayo', 'Sector Las Jones Centro', '0987654321', '0987654321', 'ACTIVO')
    `);

    // 3. Insertar Cuentas de Acceso
    await connection.query(`
      INSERT INTO cuentas (id, persona_id, rol_id, password_hash, debe_cambiar_password, estado) VALUES
      (1, 1, ${adminRol}, '${passwordHash}', FALSE, 'ACTIVA'),
      (2, 2, ${usuarioRol}, '${passwordHash}', FALSE, 'ACTIVA'),
      (3, 3, ${usuarioRol}, '${passwordHash}', FALSE, 'ACTIVA')
    `);

    // 4. Insertar Sectores y Lotes de prueba
    await connection.query(`
      INSERT INTO sectores (id, nombre, descripcion) VALUES
      (1, 'Sector Las Jones Alto', 'Canal Matriz Principal')
      ON DUPLICATE KEY UPDATE nombre=VALUES(nombre);
    `);

    await connection.query(`
      INSERT INTO lotes (id, sector_id, codigo, superficie_m2, latitud_aproximada, longitud_aproximada, radio_error_m) VALUES
      (1, 1, 'LOT-JONES-001', 2500.00, -1.332, -78.512, 5.00),
      (2, 1, 'LOT-JONES-002', 1800.00, -1.335, -78.515, 5.00)
    `);

    await connection.query(`
      INSERT INTO persona_lotes (persona_id, lote_id, tipo_relacion, porcentaje) VALUES
      (2, 1, 'PROPIETARIO', 100.00),
      (3, 2, 'PROPIETARIO', 100.00)
    `);

    console.log('----------------------------------------------------------------------');
    console.log('✅ [WhatsApp Seed] ¡Base de datos inicializada para pruebas de WhatsApp!');
    console.log('   - 1 Cuenta Administrador: Cédula 1801234567 / Contraseña: 123456');
    console.log('   - 2 Cuentas Comuneros:');
    console.log('     * Juan Morales: Cédula 1800000001 / Teléfono 0991234567');
    console.log('     * María García: Cédula 1800000002 / Teléfono 0987654321');
    console.log('----------------------------------------------------------------------');

  } catch (error) {
    console.error('❌ [WhatsApp Seed Error]:', error.message);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

seedWhatsApp();
