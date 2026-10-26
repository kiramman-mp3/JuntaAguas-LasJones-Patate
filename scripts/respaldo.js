#!/usr/bin/env node
/**
 * Respaldo y restauración de la base de datos y los documentos subidos:
 *
 *   npm run respaldo                       crea backups/junta-AAAAMMDD-HHMMSS.sql.gz (y .uploads.tar.gz)
 *   npm run respaldo -- --mantener 30      conserva solo los 30 respaldos más recientes (por defecto 14)
 *   npm run respaldo -- --restaurar ARCHIVO   restaura la base desde un respaldo .sql.gz
 *
 * Lee la conexión de backend/.env. Requiere mysqldump y mysql en el PATH; si la base corre en Docker,
 * defina RESPALDO_DOCKER_CONTENEDOR (ej. junta_las_jones_mysql) para usar los binarios del contenedor.
 * La contraseña se pasa por la variable MYSQL_PWD y nunca aparece en la lista de procesos.
 * Programación (cron / Programador de tareas): ver docs/operacion.md.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { pipeline } = require('stream/promises');
const { spawn, spawnSync } = require('child_process');

const raiz = path.join(__dirname, '..');
const carpetaRespaldos = path.join(raiz, 'backups');
const env = require(path.join(raiz, 'backend/src/config/env.js'));
const contenedor = process.env.RESPALDO_DOCKER_CONTENEDOR;

const args = process.argv.slice(2);
const valorDe = (flag) => {
  const i = args.indexOf(flag);
  return i === -1 ? undefined : args[i + 1];
};

const fallar = (mensaje) => {
  console.error(`\x1b[31m[respaldo] ${mensaje}\x1b[0m`);
  process.exit(1);
};

/** Comando y argumentos para ejecutar un binario de MySQL en el equipo o dentro del contenedor. */
function comandoMysql(binario, extra) {
  const conexion = ['-u', env.DB_USER, ...extra];
  if (contenedor) {
    return { cmd: 'docker', args: ['exec', '-i', '-e', 'MYSQL_PWD', contenedor, binario, ...conexion] };
  }
  return { cmd: binario, args: ['-h', env.DB_HOST, '-P', String(env.DB_PORT), ...conexion] };
}

const entorno = { ...process.env, MYSQL_PWD: env.DB_PASSWORD };
const marca = () => new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);

async function respaldar() {
  fs.mkdirSync(carpetaRespaldos, { recursive: true });
  const base = path.join(carpetaRespaldos, `junta-${marca()}`);
  const archivoSql = `${base}.sql.gz`;

  const { cmd, args: argumentos } = comandoMysql('mysqldump', [
    '--single-transaction', '--routines', '--triggers', '--no-tablespaces', '--default-character-set=utf8mb4', env.DB_NAME
  ]);
  const dump = spawn(cmd, argumentos, { env: entorno, stdio: ['ignore', 'pipe', 'inherit'] });
  const terminado = new Promise((resolver) => dump.on('close', resolver));
  dump.on('error', (error) => fallar(`No se pudo ejecutar ${cmd}: ${error.message}`));

  try {
    await pipeline(dump.stdout, zlib.createGzip(), fs.createWriteStream(archivoSql, { mode: 0o600 }));
  } catch (error) {
    fs.rmSync(archivoSql, { force: true });
    fallar(`Falló la escritura del respaldo: ${error.message}`);
  }
  if (await terminado !== 0 || fs.statSync(archivoSql).size < 200) {
    fs.rmSync(archivoSql, { force: true });
    fallar('mysqldump falló; no se guardó ningún respaldo.');
  }
  console.log(`  Base de datos: ${path.relative(raiz, archivoSql)} (${(fs.statSync(archivoSql).size / 1024).toFixed(0)} KB)`);

  // Documentos subidos (convocatorias, actas, comprobantes): tar viene con Windows 10+ y Linux.
  const uploads = env.UPLOADS_DIR;
  if (fs.existsSync(uploads) && fs.readdirSync(uploads).some((n) => n !== '.gitkeep')) {
    const archivoUploads = `${base}.uploads.tar.gz`;
    // El archivo va con ruta relativa: tar de GNU toma el "C:" de una ruta absoluta por un equipo remoto.
    const r = spawnSync('tar', ['-czf', path.basename(archivoUploads), '-C', path.dirname(uploads), path.basename(uploads)], { cwd: carpetaRespaldos, stdio: 'inherit' });
    if (r.status !== 0) fallar('No se pudo comprimir la carpeta de documentos subidos.');
    fs.chmodSync(archivoUploads, 0o600);
    console.log(`  Documentos:    ${path.relative(raiz, archivoUploads)}`);
  }

  rotar(Number(valorDe('--mantener') ?? 14));
  console.log('\x1b[32m[respaldo] Listo. Copie backups/ a otro equipo o disco: un respaldo en el mismo servidor no protege de una falla total.\x1b[0m');
}

/** Borra los respaldos más antiguos (la base y sus documentos comparten el prefijo). */
function rotar(mantener) {
  if (!Number.isInteger(mantener) || mantener < 1) fallar('--mantener debe ser un entero mayor o igual a 1.');
  const sqls = fs.readdirSync(carpetaRespaldos).filter((n) => /^junta-.*\.sql\.gz$/.test(n)).sort();
  for (const sql of sqls.slice(0, Math.max(0, sqls.length - mantener))) {
    const prefijo = sql.replace(/\.sql\.gz$/, '');
    fs.rmSync(path.join(carpetaRespaldos, sql), { force: true });
    fs.rmSync(path.join(carpetaRespaldos, `${prefijo}.uploads.tar.gz`), { force: true });
    console.log(`  Eliminado por antigüedad: ${prefijo}`);
  }
}

async function restaurar(archivo) {
  const ruta = path.resolve(archivo);
  if (!fs.existsSync(ruta)) fallar(`No existe el archivo ${ruta}`);
  if (env.esProduccion && !args.includes('--confirmar')) {
    fallar('Restaurar REEMPLAZA los datos actuales de la base. Detenga el servidor y repita el comando con --confirmar.');
  }
  const { cmd, args: argumentos } = comandoMysql('mysql', ['--default-character-set=utf8mb4', env.DB_NAME]);
  const cliente = spawn(cmd, argumentos, { env: entorno, stdio: ['pipe', 'inherit', 'inherit'] });
  const terminado = new Promise((resolver) => cliente.on('close', resolver));
  cliente.on('error', (error) => fallar(`No se pudo ejecutar ${cmd}: ${error.message}`));
  try {
    await pipeline(fs.createReadStream(ruta), zlib.createGunzip(), cliente.stdin);
  } catch (error) {
    fallar(`Falló la restauración: ${error.message}`);
  }
  if (await terminado !== 0) fallar('mysql terminó con error; revise la salida anterior.');
  console.log(`\x1b[32m[respaldo] Base "${env.DB_NAME}" restaurada desde ${path.basename(ruta)}.\x1b[0m`);
  console.log('  Los documentos subidos se restauran aparte: tar -xzf <archivo>.uploads.tar.gz -C <carpeta padre de uploads>');
}

const destino = valorDe('--restaurar');
if (args.includes('--restaurar') && !destino) fallar('Indique el archivo: --restaurar backups/junta-AAAAMMDD-HHMMSS.sql.gz');
(destino ? restaurar(destino) : respaldar()).catch((error) => fallar(error.message));
