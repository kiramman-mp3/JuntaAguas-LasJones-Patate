const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// Nombres y apellidos para generar datos aleatorios
const nombres = ['Juan', 'Luis', 'Carlos', 'José', 'Manuel', 'María', 'Rosa', 'Ana', 'Carmen', 'Elena', 'Pedro', 'Miguel', 'Francisco', 'David', 'Jorge', 'Gloria', 'Silvia', 'Teresa', 'Laura', 'Diana', 'Diego', 'Andrés', 'Felipe', 'Eduardo', 'Ricardo'];
const apellidos = ['García', 'López', 'Martínez', 'González', 'Rodríguez', 'Fernández', 'Pérez', 'Gómez', 'Sánchez', 'Díaz', 'Morales', 'Soria', 'Salazar', 'Guaman', 'Tamayo', 'Paredes', 'Chimbo', 'Ortiz', 'Vargas', 'Castro', 'Suárez', 'Mendoza', 'Flores', 'Ruiz'];

function getRandomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateCedula(i) {
  return '18' + String(i).padStart(8, '0'); // Empieza con 18 para Tungurahua
}

async function sembrarDatosPrueba() {
  console.log('[DB Seed] Conectando a MySQL para sembrar datos CAÓTICOS...');

  const host = process.env.DB_HOST || 'localhost';
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  const database = process.env.DB_NAME || 'junta_las_jones';

  let connection;

  try {
    connection = await mysql.createConnection({ host, user, password, database, multipleStatements: true });
    console.log(`[DB Seed] Conectado exitosamente a la base de datos '${database}'.`);

    const passwordHash = await bcrypt.hash('123456', 10);

    // 1. OBTENER ROLES Y CARGOS (Ya insertados por initDb)
    const [roles] = await connection.query(`SELECT id, codigo FROM roles`);
    const adminRol = roles.find(r => r.codigo === 'ADMIN');
    const usuarioRol = roles.find(r => r.codigo === 'USUARIO');
    
    const [conceptos] = await connection.query(`SELECT id, codigo FROM conceptos_cobro`);
    const conceptoAgua = conceptos.find(c => c.codigo === 'AGUA_MENSUAL');
    const conceptoMinga = conceptos.find(c => c.codigo === 'MULTA_MINGA');
    const conceptoAsamblea = conceptos.find(c => c.codigo === 'MULTA_ASAMBLEA');

    // 2. CREAR SECTORES
    console.log('[DB Seed] Generando Sectores...');
    await connection.query(`
      INSERT INTO sectores (id, nombre, descripcion) VALUES
      (1, 'Sector Las Jones Alto', 'Parte alta del canal matriz'),
      (2, 'Sector Las Jones Centro', 'Valle fértil de producción agrícola'),
      (3, 'Sector Las Jones Bajo', 'Zona baja cercana a la quebrada')
      ON DUPLICATE KEY UPDATE nombre=VALUES(nombre);
    `);

    // 3. GENERAR PERSONAS (~150)
    console.log('[DB Seed] Generando ~150 Personas...');
    const personas = [];
    const TOTAL_PERSONAS = 150;
    
    // Primero, los administradores fijos
    personas.push({ id: 1, cedula: '1801234567', nombres: 'Admin Fijo', apellidos: 'Sistema', rol: adminRol.id, sectorId: 1 });
    
    for (let i = 2; i <= TOTAL_PERSONAS; i++) {
      const nombreCompleto = `${getRandomItem(nombres)} ${getRandomItem(nombres)}`;
      const apellidoCompleto = `${getRandomItem(apellidos)} ${getRandomItem(apellidos)}`;
      const sectorId = getRandomInt(1, 3);
      personas.push({
        id: i,
        cedula: generateCedula(i),
        nombres: nombreCompleto,
        apellidos: apellidoCompleto,
        rol: usuarioRol.id,
        sectorId
      });
    }

    // Insertar personas en bloques
    let valuesPersonas = personas.map(p => `(${p.id}, '${p.cedula}', '${p.nombres}', '${p.apellidos}', 'Sector ${p.sectorId}', '099${getRandomInt(1000000, 9999999)}', 'ACTIVO')`).join(',');
    await connection.query(`INSERT INTO personas (id, cedula, nombres, apellidos, direccion, celular, estado) VALUES ${valuesPersonas} ON DUPLICATE KEY UPDATE id=id`);

    // 4. CREAR CUENTAS
    console.log('[DB Seed] Generando cuentas de usuario...');
    let valuesCuentas = personas.map(p => `(${p.id}, ${p.id}, ${p.rol}, '${passwordHash}', FALSE, 'ACTIVA')`).join(',');
    await connection.query(`INSERT INTO cuentas (id, persona_id, rol_id, password_hash, debe_cambiar_password, estado) VALUES ${valuesCuentas} ON DUPLICATE KEY UPDATE id=id`);

    // 5. GENERAR LOTES GEORREFERENCIADOS (~200)
    console.log('[DB Seed] Generando Lotes Georreferenciados...');
    const TOTAL_LOTES = 200;
    const lotesData = [];
    const personaLotesData = [];
    for (let i = 1; i <= TOTAL_LOTES; i++) {
      const sectorId = getRandomInt(1, 3);
      let lat = -1.33 + (Math.random() * 0.02) - 0.01;
      let lng = -78.51 + (Math.random() * 0.02) - 0.01;
      lotesData.push(`(${i}, ${sectorId}, 'LOT-${i}', ${getRandomInt(1000, 5000)}.00, ${lat}, ${lng}, 5.00)`);
      
      // Asignar lote a una persona aleatoria (algunas pueden tener 2 lotes)
      const personaId = getRandomInt(1, TOTAL_PERSONAS);
      personaLotesData.push(`(${personaId}, ${i}, 'PROPIETARIO', 100.00, '2020-01-01')`);
    }
    
    await connection.query(`INSERT INTO lotes (id, sector_id, codigo, superficie_m2, latitud_aproximada, longitud_aproximada, radio_error_m) VALUES ${lotesData.join(',')} ON DUPLICATE KEY UPDATE id=id`);
    await connection.query(`INSERT INTO persona_lotes (persona_id, lote_id, tipo_relacion, porcentaje, fecha_desde) VALUES ${personaLotesData.join(',')} ON DUPLICATE KEY UPDATE persona_id=persona_id`);

    // 6. GENERAR EVENTOS (Asambleas y Mingas - Pasados y Futuros)
    console.log('[DB Seed] Generando Eventos y Asistencias...');
    const eventosData = [];
    // 5 pasados, 3 futuros
    for (let i = 1; i <= 8; i++) {
      const tipo = i % 2 === 0 ? 'ASAMBLEA' : 'MINGA';
      const fecha = new Date();
      if (i <= 5) {
        fecha.setDate(fecha.getDate() - (10 * i)); // Pasado
      } else {
        fecha.setDate(fecha.getDate() + (5 * (i - 5))); // Futuro
      }
      const dateStr = fecha.toISOString().split('T')[0];
      const estado = i <= 5 ? 'REALIZADO' : 'PROGRAMADO';
      eventosData.push(`(${i}, '${tipo}', '${tipo} General ${i}', '${dateStr}', '08:00:00', TRUE, 20.00, '${estado}', 1)`);
    }
    await connection.query(`INSERT INTO eventos (id, tipo, titulo, fecha, hora_inicio, genera_multa_ausencia, valor_multa, estado, created_by_cuenta_id) VALUES ${eventosData.join(',')} ON DUPLICATE KEY UPDATE id=id`);

    // ASISTENCIAS (Solo a los pasados)
    const asistenciasData = [];
    for (let evId = 1; evId <= 5; evId++) {
      for (let pId = 1; pId <= TOTAL_PERSONAS; pId++) {
        // 80% presentes, 20% ausentes
        const estado = Math.random() > 0.2 ? 'PRESENTE' : 'AUSENTE';
        asistenciasData.push(`(${evId}, ${pId}, '${estado}')`);
      }
    }
    // Batch insert de asistencias
    const chunkSize = 500;
    for (let i = 0; i < asistenciasData.length; i += chunkSize) {
      const chunk = asistenciasData.slice(i, i + chunkSize);
      await connection.query(`INSERT INTO asistencias (evento_id, persona_id, estado) VALUES ${chunk.join(',')} ON DUPLICATE KEY UPDATE estado=estado`);
    }

    // 7. GENERAR OBLIGACIONES Y PAGOS
    console.log('[DB Seed] Generando Obligaciones y Pagos...');
    const obligacionesData = [];
    const pagosData = [];
    const pagoDetallesData = [];
    let oblId = 1;
    let pagoId = 1;

    for (let pId = 1; pId <= TOTAL_PERSONAS; pId++) {
      // 3 meses de agua para cada persona
      for (let mes = 1; mes <= 3; mes++) {
        const pagada = Math.random() > 0.3; // 70% de probabilidad de estar pagada
        const estado = pagada ? 'PAGADA' : 'PENDIENTE';
        obligacionesData.push(`(${oblId}, ${pId}, ${conceptoAgua.id}, NULL, 5.00, 2024, ${mes}, '${estado}')`);
        
        if (pagada) {
          pagosData.push(`(${pagoId}, ${pId}, 5.00, 'EFECTIVO', '2024-0${mes}-15', 1)`);
          pagoDetallesData.push(`(${pagoId}, ${oblId}, 5.00)`);
          pagoId++;
        }
        oblId++;
      }
      
      // Añadir multas a los que faltaron a la asamblea 1
      const [ausentes] = await connection.query(`SELECT evento_id FROM asistencias WHERE persona_id = ${pId} AND estado = 'AUSENTE' LIMIT 2`);
      for (const a of ausentes) {
        const pagada = Math.random() > 0.5;
        const estado = pagada ? 'PAGADA' : 'PENDIENTE';
        obligacionesData.push(`(${oblId}, ${pId}, ${conceptoAsamblea.id}, ${a.evento_id}, 20.00, 2024, NULL, '${estado}')`);
        if (pagada) {
          pagosData.push(`(${pagoId}, ${pId}, 20.00, 'TRANSFERENCIA', '2024-05-15', 1)`);
          pagoDetallesData.push(`(${pagoId}, ${oblId}, 20.00)`);
          pagoId++;
        }
        oblId++;
      }
    }

    for (let i = 0; i < obligacionesData.length; i += chunkSize) {
      await connection.query(`INSERT INTO obligaciones (id, persona_id, concepto_id, evento_id, valor, periodo_anio, periodo_mes, estado) VALUES ${obligacionesData.slice(i, i + chunkSize).join(',')} ON DUPLICATE KEY UPDATE id=id`);
    }
    
    if (pagosData.length > 0) {
      for (let i = 0; i < pagosData.length; i += chunkSize) {
        await connection.query(`INSERT INTO pagos (id, persona_id, valor_total, metodo, fecha_pago, registrado_por_cuenta_id) VALUES ${pagosData.slice(i, i + chunkSize).join(',')} ON DUPLICATE KEY UPDATE id=id`);
        await connection.query(`INSERT INTO pago_detalles (pago_id, obligacion_id, valor_pagado) VALUES ${pagoDetallesData.slice(i, i + chunkSize).join(',')} ON DUPLICATE KEY UPDATE pago_id=pago_id`);
      }
    }

    // 8. TURNOS DE RIEGO
    console.log('[DB Seed] Generando Turnos de Riego...');
    const turnosData = [];
    for (let i = 1; i <= 30; i++) {
      const pId = getRandomInt(1, TOTAL_PERSONAS);
      const lId = getRandomInt(1, TOTAL_LOTES);
      const dia = getRandomInt(0, 6);
      const hora = getRandomInt(6, 16);
      turnosData.push(`(${pId}, ${lId}, 'REGULAR', ${dia}, '${hora}:00:00', '${hora+2}:00:00', 'ACTIVO')`);
    }
    await connection.query(`INSERT INTO turnos_riego (persona_id, lote_id, tipo, dia_semana, hora_inicio, hora_fin, estado) VALUES ${turnosData.join(',')} ON DUPLICATE KEY UPDATE id=id`);

    console.log('----------------------------------------------------------------------');
    console.log(`✅ [DB Seed] ¡ÉXITO! Se sembraron datos caóticos (${TOTAL_PERSONAS} personas, ${TOTAL_LOTES} lotes, ${eventosData.length} eventos, miles de deudas).`);
    console.log('----------------------------------------------------------------------');

  } catch (error) {
    console.error('❌ [DB Seed Error] Falló la siembra de datos:');
    if (error.sqlMessage) {
      console.error(error.code, error.sqlMessage);
    } else {
      console.error(error);
    }
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('[DB Seed] Conexión MySQL cerrada.');
    }
  }
}

if (require.main === module) {
  sembrarDatosPrueba();
}

module.exports = { sembrarDatosPrueba };
