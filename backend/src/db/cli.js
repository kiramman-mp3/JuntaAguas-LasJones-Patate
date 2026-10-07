#!/usr/bin/env node
/**
 * Tareas de base de datos:
 *   node src/db/cli.js migrate          Aplica migraciones pendientes (crea la base si no existe).
 *   node src/db/cli.js setup            Base lista para producción: migraciones y, si no hay ninguno,
 *                                       el primer administrador (ADMIN_CEDULA, ADMIN_NOMBRES, ADMIN_APELLIDOS).
 *                                       No siembra datos de prueba ni borra nada: se puede repetir sin riesgo.
 *   node src/db/cli.js drop --yes       Elimina la base de datos (solo fuera de producción).
 *   node src/db/cli.js seed [--reset]   Siembra datos de prueba realistas (solo fuera de producción).
 *                                       --reset recrea la base antes de sembrar.
 */
const env = require('../config/env');
const { conectarServidor, conectarBase } = require('./connection');
const { migrate } = require('./migrator');
const { asegurarAdminInicial } = require('./adminInicial');
const { generarPasswordTemporal, problemaConPassword } = require('../shared/passwords');

async function eliminarBase() {
  const conexion = await conectarServidor();
  try {
    await conexion.query(`DROP DATABASE IF EXISTS \`${env.DB_NAME}\``);
    console.log(`[db] Base de datos '${env.DB_NAME}' eliminada.`);
  } finally {
    await conexion.end();
  }
}

async function sembrarBase(flags) {
  if (env.esProduccion) throw new Error('No se permite sembrar datos de prueba en producción.');
  // Contraseña común de las cuentas sembradas: SEED_PASSWORD si cumple la política, o una aleatoria.
  const password = process.env.SEED_PASSWORD || generarPasswordTemporal(12);
  const problema = problemaConPassword(password);
  if (problema) throw new Error(`SEED_PASSWORD no es válida: ${problema}`);

  if (flags.includes('--reset')) await eliminarBase();
  const conexion = await conectarBase();
  try {
    await migrate(conexion);
    const { sembrar } = require('./seed');
    const r = await sembrar(conexion, { password });
    console.log(`[seed] ${r.comuneros} comuneros (${r.retirados} retirados), ${r.cuentas} cuentas, ${r.lotes} lotes, ${r.turnos} turnos.`);
    console.log(`[seed] ${r.facturas} cuotas de agua, ${r.eventosRealizados} eventos realizados, ${r.multas} multas, ${r.pagos} pagos (${r.anulaciones} anulados).`);
    console.log(`[seed] ${r.egresos} egresos, ${r.bienes} bienes de inventario, ${r.actividades} actividades del plan anual.`);
    console.log('[seed] Credenciales (todas las cuentas sembradas usan la misma contraseña):');
    console.log(`         Administrador: ${r.admin.cedula} (${r.admin.nombre})`);
    console.log(`         Comunero:      ${r.demo.cedula} (${r.demo.nombre})`);
    console.log(`         Contraseña:    ${password}`);
  } finally {
    await conexion.end();
  }
}

async function main() {
  const [comando, ...flags] = process.argv.slice(2);

  if (comando === 'migrate') {
    const conexion = await conectarBase();
    try {
      await migrate(conexion);
    } finally {
      await conexion.end();
    }
    return;
  }

  if (comando === 'setup') {
    const conexion = await conectarBase();
    try {
      await migrate(conexion);
      const admin = await asegurarAdminInicial(conexion, {
        cedula: process.env.ADMIN_CEDULA,
        nombres: process.env.ADMIN_NOMBRES,
        apellidos: process.env.ADMIN_APELLIDOS
      });
      if (admin.creado) {
        console.log('[setup] Administrador inicial creado. Anote estos datos: la contraseña no se vuelve a mostrar.');
        console.log(`         Usuario (cédula): ${admin.cedula} (${admin.nombre})`);
        console.log(`         Contraseña temporal: ${admin.passwordTemporal}`);
        console.log('         Deberá elegir una contraseña nueva en su primer ingreso.');
      } else {
        console.log('[setup] Ya existe un administrador activo; no se creó ninguno nuevo.');
      }
    } finally {
      await conexion.end();
    }
    return;
  }

  if (comando === 'drop') {
    if (env.esProduccion) throw new Error('No se permite eliminar la base de datos en producción.');
    if (!flags.includes('--yes')) {
      throw new Error(`Esta acción elimina la base '${env.DB_NAME}' por completo. Repite el comando con --yes para confirmar.`);
    }
    await eliminarBase();
    return;
  }

  if (comando === 'seed') {
    await sembrarBase(flags);
    return;
  }

  throw new Error('Uso: node src/db/cli.js <migrate|setup|drop --yes|seed [--reset]>');
}

main().catch((error) => {
  console.error(`[db] ${error.message}`);
  process.exit(1);
});
