const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

/**
 * Script utilitario para sembrar datos iniciales (Seed Data) en la base de datos de la Junta La Jones
 */
async function sembrarDatosPrueba() {
  console.log('[DB Seed] Conectando a MySQL para sembrar datos de prueba...');

  const host = process.env.DB_HOST || 'localhost';
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  const database = process.env.DB_NAME || 'junta_las_jones';

  let connection;

  try {
    connection = await mysql.createConnection({
      host,
      user,
      password,
      database,
      multipleStatements: true
    });

    console.log(`[DB Seed] Conectado exitosamente a la base de datos '${database}'.`);

    // 1. Hashear contraseña por defecto '123456'
    const passwordHash = await bcrypt.hash('123456', 10);

    // 2. Insertar Personas / Comuneros de prueba
    console.log('[DB Seed] Insertando comuneros...');
    await connection.query(`
      INSERT INTO personas (id, cedula, nombres, apellidos, direccion, telefono, celular, email, estado) VALUES
      (1, '1801234567', 'Juan Carlos', 'Morales Soria', 'Sector Las Jones Alto', '032870112', '0991234567', 'juan.morales@jones.ec', 'ACTIVO'),
      (2, '1802345678', 'Luis Fernando', 'Salazar Guaman', 'Sector Las Jones Centro', '032870223', '0992345678', 'luis.salazar@jones.ec', 'ACTIVO'),
      (3, '1803456789', 'María Elena', 'Tamayo Paredes', 'Sector Las Jones Alto', '032870334', '0993456789', 'maria.tamayo@jones.ec', 'ACTIVO'),
      (4, '1804567890', 'Segundo Luis', 'Chimbo Ortiz', 'Sector Las Jones Alto', '032870445', '0994567890', 'segundo.chimbo@jones.ec', 'ACTIVO'),
      (5, '1805678901', 'Rosa Mercedes', 'Vargas Paredes', 'Sector Las Jones Bajo', '032870556', '0995678901', 'rosa.vargas@jones.ec', 'ACTIVO'),
      (6, '1806789012', 'Carlos Alfredo', 'Ortiz López', 'Sector Las Jones Centro', '032870667', '0996789012', 'carlos.ortiz@jones.ec', 'ACTIVO')
      ON DUPLICATE KEY UPDATE nombres=VALUES(nombres);
    `);

    // 3. Obtener ID del rol ADMIN
    const [roles] = await connection.query(`SELECT id, codigo FROM roles`);
    const adminRol = roles.find(r => r.codigo === 'ADMIN') || roles[0];
    const usuarioRol = roles.find(r => r.codigo === 'USUARIO') || roles[0];

    // 4. Insertar Cuentas de Acceso
    console.log('[DB Seed] Creando cuentas de usuario (Contraseña inicial: 123456)...');
    await connection.query(`
      INSERT INTO cuentas (id, persona_id, rol_id, password_hash, debe_cambiar_password, estado) VALUES
      (1, 1, ${adminRol.id}, '${passwordHash}', FALSE, 'ACTIVA'),
      (2, 2, ${adminRol.id}, '${passwordHash}', FALSE, 'ACTIVA'),
      (3, 3, ${adminRol.id}, '${passwordHash}', FALSE, 'ACTIVA'),
      (4, 4, ${usuarioRol.id}, '${passwordHash}', TRUE, 'ACTIVA'),
      (5, 5, ${usuarioRol.id}, '${passwordHash}', TRUE, 'ACTIVA')
      ON DUPLICATE KEY UPDATE estado=VALUES(estado);
    `);

    // 5. Directiva de la Junta
    console.log('[DB Seed] Registrando la Directiva de la Junta...');
    const [cargos] = await connection.query(`SELECT id, nombre FROM cargos_directiva`);
    const presCargo = cargos.find(c => c.nombre === 'Presidente') || cargos[0];
    const tesorCargo = cargos.find(c => c.nombre === 'Tesorero') || cargos[0];
    const secCargo = cargos.find(c => c.nombre === 'Secretario') || cargos[0];

    await connection.query(`
      INSERT INTO miembros_directiva (persona_id, cargo_id, fecha_inicio, fecha_fin, estado, observacion) VALUES
      (1, ${presCargo.id}, '2025-01-01', '2026-12-31', 'VIGENTE', 'Periodo Directivo 2025-2026'),
      (2, ${tesorCargo.id}, '2025-01-01', '2026-12-31', 'VIGENTE', 'Periodo Directivo 2025-2026'),
      (3, ${secCargo.id}, '2025-01-01', '2026-12-31', 'VIGENTE', 'Periodo Directivo 2025-2026')
      ON DUPLICATE KEY UPDATE estado=VALUES(estado);
    `);

    // 6. Sectores y Lotes Georreferenciados
    console.log('[DB Seed] Insertando sectores y lotes con coordenadas GPS...');
    await connection.query(`
      INSERT INTO sectores (id, nombre, descripcion) VALUES
      (1, 'Sector Las Jones Alto', 'Parte alta del canal matriz de la acequia Jones'),
      (2, 'Sector Las Jones Centro', 'Valle fértil de producción agrícola'),
      (3, 'Sector Las Jones Bajo', 'Zona baja cercana a la quebrada')
      ON DUPLICATE KEY UPDATE nombre=VALUES(nombre);

      INSERT INTO lotes (id, sector_id, codigo, superficie_m2, ancho_m, largo_m, latitud_aproximada, longitud_aproximada, radio_error_m, referencia_ubicacion, observacion) VALUES
      (1, 1, 'LOT-JONES-A04', 2500.00, 50.00, 50.00, -1.3324100, -78.5142100, 5.00, 'Frente al reservorio #1', 'Terreno con cultivo de tomate de árbol'),
      (2, 2, 'LOT-JONES-C12', 1800.00, 30.00, 60.00, -1.3350200, -78.5110500, 5.00, 'Junto a la casa del agua', 'Cultivo de mandarinas'),
      (3, 1, 'LOT-JONES-A09', 3200.00, 40.00, 80.00, -1.3311000, -78.5160000, 5.00, 'Límite norte del canal', 'Terreno en producción'),
      (4, 3, 'LOT-JONES-B02', 1450.00, 29.00, 50.00, -1.3392000, -78.5089000, 5.00, 'Sector ramal bajo', 'Huerto frutal')
      ON DUPLICATE KEY UPDATE codigo=VALUES(codigo);

      INSERT INTO persona_lotes (persona_id, lote_id, tipo_relacion, porcentaje, fecha_desde) VALUES
      (1, 1, 'PROPIETARIO', 100.00, '2020-01-01'),
      (2, 2, 'PROPIETARIO', 100.00, '2021-03-15'),
      (4, 3, 'PROPIETARIO', 100.00, '2019-06-10'),
      (5, 4, 'PROPIETARIO', 100.00, '2022-02-20')
      ON DUPLICATE KEY UPDATE tipo_relacion=VALUES(tipo_relacion);
    `);

    // 7. Turnos de Agua
    console.log('[DB Seed] Insertando horarios de riego...');
    await connection.query(`
      INSERT INTO turnos_riego (persona_id, lote_id, tipo, dia_semana, hora_inicio, hora_fin, estado, observacion) VALUES
      (1, 1, 'REGULAR', 1, '08:00:00', '12:00:00', 'ACTIVO', 'Turno regular Lunes mañana'),
      (2, 2, 'REGULAR', 1, '12:00:00', '16:00:00', 'ACTIVO', 'Turno regular Lunes tarde'),
      (4, 3, 'REGULAR', 2, '08:00:00', '12:00:00', 'ACTIVO', 'Turno regular Martes mañana'),
      (5, 4, 'REGULAR', 3, '09:00:00', '13:00:00', 'ACTIVO', 'Turno regular Miércoles mañana')
      ON DUPLICATE KEY UPDATE estado=VALUES(estado);
    `);

    // 8. Tarifas por Defecto
    console.log('[DB Seed] Asignando tarifas vigentes...');
    const [conceptos] = await connection.query(`SELECT id, codigo FROM conceptos_cobro`);
    const cAgua = conceptos.find(c => c.codigo === 'AGUA_MENSUAL') || conceptos[0];
    const cAsamblea = conceptos.find(c => c.codigo === 'MULTA_ASAMBLEA') || conceptos[1];
    const cMinga = conceptos.find(c => c.codigo === 'MULTA_MINGA') || conceptos[2];

    await connection.query(`
      INSERT INTO tarifas (concepto_id, valor, vigencia_desde, activo, observacion) VALUES
      (${cAgua.id}, 10.00, '2026-01-01', TRUE, 'Tarifa mensual regular 2026'),
      (${cAsamblea.id}, 10.00, '2026-01-01', TRUE, 'Multa inasistencia asamblea 2026'),
      (${cMinga.id}, 15.00, '2026-01-01', TRUE, 'Multa inasistencia minga 2026')
      ON DUPLICATE KEY UPDATE valor=VALUES(valor);
    `);

    // 9. Obligaciones y Pagos de prueba
    console.log('[DB Seed] Insertando deudas, obligaciones y pagos...');
    await connection.query(`
      INSERT INTO obligaciones (id, persona_id, concepto_id, tarifa_id, periodo_anio, periodo_mes, fecha_emision, valor, origen, estado, observacion) VALUES
      (101, 1, ${cAgua.id}, 1, 2026, 8, '2026-08-01', 10.00, 'MANUAL', 'PENDIENTE', 'Cuota de agua de riego Agosto 2026'),
      (102, 1, ${cAsamblea.id}, 2, 2026, 7, '2026-07-15', 10.00, 'AUTOMATICA', 'PENDIENTE', 'Multa por inasistencia a Asamblea #2'),
      (103, 1, ${cMinga.id}, 3, 2026, 8, '2026-08-20', 15.00, 'AUTOMATICA', 'PENDIENTE', 'Multa por inasistencia a Minga #1'),
      (104, 1, ${cAgua.id}, 1, 2026, 7, '2026-07-01', 10.00, 'MANUAL', 'PAGADA', 'Cuota de agua Julio 2026'),
      (105, 2, ${cAgua.id}, 1, 2026, 8, '2026-08-01', 10.00, 'MANUAL', 'PAGADA', 'Cuota de agua Agosto 2026')
      ON DUPLICATE KEY UPDATE estado=VALUES(estado);

      INSERT INTO pagos (id, persona_id, fecha_pago, valor_total, metodo, referencia, registrado_por_cuenta_id) VALUES
      (1, 1, '2026-07-05 10:30:00', 10.00, 'EFECTIVO', 'REC-00101', 1),
      (2, 2, '2026-08-03 11:15:00', 10.00, 'TRANSFERENCIA', 'TRF-99881', 1)
      ON DUPLICATE KEY UPDATE valor_total=VALUES(valor_total);

      INSERT INTO pago_detalles (pago_id, obligacion_id, valor_pagado) VALUES
      (1, 104, 10.00),
      (2, 105, 10.00)
      ON DUPLICATE KEY UPDATE valor_pagado=VALUES(valor_pagado);
    `);

    // 10. Egresos y Proveedores
    console.log('[DB Seed] Insertando registros de egresos y proveedores...');
    await connection.query(`
      INSERT INTO proveedores (id, identificacion, nombre, telefono, direccion) VALUES
      (1, '1891234567001', 'Ferretería El Valle S.A.', '032870999', 'Av. Ambato y Tungurahua, Patate'),
      (2, '1892345678001', 'Servicios Hidráulicos Patate', '032870888', 'Sector Central')
      ON DUPLICATE KEY UPDATE nombre=VALUES(nombre);

      INSERT INTO egresos (proveedor_id, fecha, concepto, descripcion, numero_factura, valor, registrado_por_cuenta_id) VALUES
      (1, '2026-08-05', 'Compra de tubería PVC de 110mm', 'Tubos para reparación canal secundario', '001-002-000456', 150.00, 1),
      (2, '2026-08-12', 'Mantenimiento de válvula principal', 'Trabajo especializado de limpieza de compuerta', '001-001-000128', 170.00, 1)
      ON DUPLICATE KEY UPDATE valor=VALUES(valor);
    `);

    // 11. Inventario y Plan Anual
    console.log('[DB Seed] Insertando bienes de inventario y plan operativo anual...');
    await connection.query(`
      INSERT INTO bienes_inventario (codigo, nombre, descripcion, cantidad, valor_unitario, fecha_adquisicion, estado_fisico, ubicacion) VALUES
      ('INV-BOMBA-01', 'Bomba de Agua Diésel 5HP', 'Bomba portátil de achique', 1, 650.00, '2024-03-10', 'EXCELENTE', 'Casa Comunal'),
      ('INV-HERR-01', 'Palas de Acero de Mango Largo', 'Herramientas de trabajo para mingas', 25, 12.50, '2025-01-15', 'BUENO', 'Bodega de Herramientas'),
      ('INV-HERR-02', 'Azadones Agrícolas', 'Azadones reforzados para limpieza de acequia', 20, 14.00, '2025-01-15', 'BUENO', 'Bodega de Herramientas')
      ON DUPLICATE KEY UPDATE nombre=VALUES(nombre);

      INSERT INTO planes_anuales (id, anio, descripcion, estado, created_by_cuenta_id) VALUES
      (1, 2026, 'Plan Operativo Anual de Riego e Infraestructura 2026', 'ACTIVO', 1)
      ON DUPLICATE KEY UPDATE anio=VALUES(anio);

      INSERT INTO actividades_plan (plan_id, nombre, descripcion, fecha_inicio, fecha_fin, estado) VALUES
      (1, 'Mantenimiento preventivo del Canal Matriz', 'Limpieza general de desarenadores', '2026-01-10', '2026-02-15', 'CUMPLIDA'),
      (1, 'Capacitación sobre eficiencia del riego', 'Taller comunal sobre uso del agua', '2026-09-01', '2026-09-30', 'EN_PROCESO')
      ON DUPLICATE KEY UPDATE nombre=VALUES(nombre);
    `);

    console.log('----------------------------------------------------------------------');
    console.log('🌱 [DB Seed] ¡ÉXITO! La siembra de datos de prueba ha finalizado.');
    console.log('   - 6 Comuneros de prueba insertados (Cédula Admin: 1801234567).');
    console.log('   - Cuentas activas creadas (Contraseña inicial: 123456).');
    console.log('   - Directiva, Sectores, Lotes georreferenciados y Turnos listos.');
    console.log('   - Tarifas, Obligaciones pendientes y Pagos cargados.');
    console.log('   - Egresos, Inventario y Plan Anual 2026 configurados.');
    console.log('----------------------------------------------------------------------');

  } catch (error) {
    console.error('❌ [DB Seed Error] Falló la siembra de datos de prueba:', error.message);
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
