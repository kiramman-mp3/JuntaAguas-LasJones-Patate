const mysql = require('mysql2/promise');
const env = require('./env');

const pool = mysql.createPool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  // Las columnas DATE se devuelven como 'YYYY-MM-DD' para evitar desfases de zona horaria.
  dateStrings: ['DATE'],
  // Los DATETIME se guardan en UTC (ver SET time_zone abajo).
  timezone: 'Z',
  decimalNumbers: true
});

// Cada conexión trabaja en UTC, sin depender de la configuración del servidor MySQL.
pool.pool.on('connection', (conexion) => {
  conexion.query("SET time_zone = '+00:00'");
});

module.exports = pool;
