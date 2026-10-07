const mysql = require('mysql2/promise');
const env = require('../config/env');

/** Conexión al servidor MySQL (sin base seleccionada) para tareas administrativas. */
function conectarServidor() {
  return mysql.createConnection({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    dateStrings: ['DATE'],
    timezone: 'Z',
    decimalNumbers: true
  });
}

/** Crea la base si no existe y devuelve una conexión posicionada en ella. */
async function conectarBase(nombre = env.DB_NAME) {
  const conexion = await conectarServidor();
  await conexion.query(`CREATE DATABASE IF NOT EXISTS \`${nombre}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await conexion.query(`USE \`${nombre}\``);
  await conexion.query("SET time_zone = '+00:00'");
  return conexion;
}

module.exports = { conectarServidor, conectarBase };
