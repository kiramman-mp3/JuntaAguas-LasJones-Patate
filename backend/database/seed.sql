-- ==============================================================================
-- SEED DATA - JUNTA DE AGUA Y RIEGO "LA JONES" - PATATE
-- Datos de prueba para desarrollo
-- Contraseña de todos los usuarios: su cédula (hasheada con bcrypt)
-- Admin: admin / cédula 1800000001 / contraseña: 1800000001
-- ==============================================================================

USE junta_las_jones;

SET FOREIGN_KEY_CHECKS = 0;

-- ==============================================================================
-- SECTORES (necesarios para lotes)
-- ==============================================================================
INSERT INTO sectores (nombre, descripcion) VALUES
('La Jones Alta', 'Sector superior de la comunidad La Jones'),
('La Jones Baja', 'Sector inferior de la comunidad La Jones'),
('El Tambo', 'Sector El Tambo, colindante con el río'),
('Los Cuyes', 'Sector Los Cuyes, zona media')
ON DUPLICATE KEY UPDATE nombre=VALUES(nombre);

-- ==============================================================================
-- PERSONAS (Comuneros)
-- ==============================================================================
INSERT INTO personas (cedula, nombres, apellidos, direccion, telefono, celular, email, estado) VALUES
('1800000001', 'Carlos Eduardo', 'Moreta Salazar', 'Barrio La Jones Alta, frente a la escuela', '032850123', '0987654321', 'admin@juntajones.gob.ec', 'ACTIVO'),
('1800000002', 'María Rosa', 'Quispe Toapanta', 'La Jones Baja, casa verde', '032850124', '0991234567', 'mquispe@gmail.com', 'ACTIVO'),
('1800000003', 'Pedro José', 'Aldaz Tigse', 'El Tambo, sector 2', '032850125', '0985678901', NULL, 'ACTIVO'),
('1800000004', 'Ana Lucía', 'Naranjo Freire', 'La Jones Alta, lote 12', NULL, '0993456789', 'ananaranjof@hotmail.com', 'ACTIVO'),
('1800000005', 'Luis Germán', 'Ortiz Chávez', 'Los Cuyes, entrada principal', '032850126', '0978901234', NULL, 'ACTIVO'),
('1800000006', 'Carmen Dolores', 'Sailema Pilco', 'La Jones Baja, junto al canal', NULL, '0967890123', NULL, 'ACTIVO'),
('1800000007', 'Juan Pablo', 'Bonilla Vásquez', 'El Tambo, parcela 7', '032850127', '0956789012', 'jpbonilla@gmail.com', 'ACTIVO'),
('1800000008', 'Rosa Elena', 'Chango Masabanda', 'La Jones Alta, detrás del tanque', NULL, '0945678901', NULL, 'ACTIVO'),
('1800000009', 'Miguel Ángel', 'Taipe Caisaguano', 'Los Cuyes, casa azul', '032850128', '0934567890', NULL, 'ACTIVO'),
('1800000010', 'Gloria Esperanza', 'Buenaño Paredes', 'La Jones Baja, parcela 3', NULL, '0923456789', NULL, 'ACTIVO'),
('1800000011', 'Segundo Roberto', 'Pilatasig Shiguango', 'El Tambo, lote 15', '032850129', '0912345678', NULL, 'ACTIVO'),
('1800000012', 'Teresa Inés', 'Chasipanta Tigse', 'La Jones Alta, casa blanca', NULL, '0999887766', NULL, 'ACTIVO'),
('1800000013', 'Wilson Fernando', 'Caiza Guanoluisa', 'Los Cuyes, sector norte', '032850130', '0988776655', NULL, 'ACTIVO'),
('1800000014', 'Margarita Elena', 'Toalombo Yugsi', 'La Jones Baja, parcela 9', NULL, '0977665544', NULL, 'ACTIVO'),
('1800000015', 'Fausto Ramiro', 'Llerena Palacios', 'El Tambo, entrada', '032850131', '0966554433', 'faustoL@gmail.com', 'ACTIVO'),
('1800000016', 'Silvia Jimena', 'Mera Córdova', 'La Jones Alta, lote 8', NULL, '0955443322', NULL, 'INACTIVO'),
('1800000017', 'Rodrigo Patricio', 'Vega Barona', 'Los Cuyes, casa amarilla', '032850132', '0944332211', NULL, 'ACTIVO'),
('1800000018', 'Martha Cecilia', 'Arroyo Ponce', 'La Jones Baja, junto al puente', NULL, '0933221100', NULL, 'ACTIVO'),
('1800000019', 'Jorge Enrique', 'Zurita Molina', 'El Tambo, parcela 11', '032850133', '0922110099', NULL, 'ACTIVO'),
('1800000020', 'Diana Carolina', 'Mayorga Herrera', 'La Jones Alta, casa naranja', NULL, '0911009988', 'dmayor@gmail.com', 'ACTIVO')
ON DUPLICATE KEY UPDATE estado=VALUES(estado);

-- ==============================================================================
-- CUENTAS DE ACCESO
-- Contraseña = cédula del usuario (bcrypt hash de "1800000001", etc.)
-- Para desarrollo, usamos el hash de "admin123" que es el mismo para todos
-- Hash bcrypt de "1800000001": $2b$10$X5ygXbM5qU.1NTz3v4.TiOLVRBSQ8u.aiqT1S3gFq2Vu6mFBqTf0a
-- ==============================================================================
INSERT INTO cuentas (persona_id, rol_id, password_hash, debe_cambiar_password, estado) VALUES
(1, 1, '$2a$10$O/fKwjoSZVq8DP8d24O5fuO/RpohuNFPMrtjYacQFae23uV9uPEDu', FALSE, 'ACTIVA'),
(2, 2, '$2a$10$O/fKwjoSZVq8DP8d24O5fuO/RpohuNFPMrtjYacQFae23uV9uPEDu', TRUE, 'ACTIVA'),
(3, 2, '$2a$10$O/fKwjoSZVq8DP8d24O5fuO/RpohuNFPMrtjYacQFae23uV9uPEDu', TRUE, 'ACTIVA')
ON DUPLICATE KEY UPDATE estado=VALUES(estado);

-- ==============================================================================
-- MIEMBROS DE LA DIRECTIVA
-- ==============================================================================
INSERT INTO miembros_directiva (persona_id, cargo_id, fecha_inicio, estado) VALUES
(1, 1, '2024-01-15', 'VIGENTE'),
(2, 3, '2024-01-15', 'VIGENTE'),
(3, 4, '2024-01-15', 'VIGENTE')
ON DUPLICATE KEY UPDATE estado=VALUES(estado);

-- ==============================================================================
-- LOTES
-- ==============================================================================
INSERT INTO lotes (sector_id, codigo, superficie_m2, referencia_ubicacion, latitud_aproximada, longitud_aproximada) VALUES
(1, 'LJA-001', 2500.00, 'Frente a la escuela primaria', -1.2456, -78.5123),
(1, 'LJA-002', 1800.00, 'Junto al tanque de agua', -1.2467, -78.5134),
(1, 'LJA-003', 3200.00, 'Esquina norte, casa blanca', -1.2478, -78.5145),
(2, 'LJB-001', 2100.00, 'Junto al canal principal', -1.2489, -78.5156),
(2, 'LJB-002', 1500.00, 'Parcela junto al puente', -1.2500, -78.5167),
(3, 'ELT-001', 4000.00, 'Parcela sur, colindante al río', -1.2511, -78.5178),
(3, 'ELT-002', 2800.00, 'Parcela 7, sector central', -1.2522, -78.5189),
(4, 'LCU-001', 1900.00, 'Casa azul, entrada principal', -1.2533, -78.5200)
ON DUPLICATE KEY UPDATE codigo=VALUES(codigo);

-- ==============================================================================
-- PERSONA-LOTE (propietarios)
-- ==============================================================================
INSERT INTO persona_lotes (persona_id, lote_id, tipo_relacion, porcentaje, fecha_desde) VALUES
(1, 1, 'PROPIETARIO', 100, '2020-01-01'),
(2, 2, 'PROPIETARIO', 100, '2020-01-01'),
(3, 3, 'PROPIETARIO', 100, '2020-01-01'),
(4, 4, 'PROPIETARIO', 100, '2020-01-01'),
(5, 5, 'PROPIETARIO', 100, '2020-01-01'),
(6, 6, 'PROPIETARIO', 50, '2020-01-01'),
(7, 6, 'COPROPIETARIO', 50, '2020-01-01'),
(7, 7, 'PROPIETARIO', 100, '2020-01-01'),
(8, 8, 'PROPIETARIO', 100, '2020-01-01');

-- ==============================================================================
-- EVENTOS PRÓXIMOS (fechas futuras para que aparezcan en la pantalla)
-- ==============================================================================
INSERT INTO eventos (tipo, titulo, descripcion, fecha, hora_inicio, hora_fin, lugar, requiere_asistencia, genera_multa_ausencia, valor_multa, estado, created_by_cuenta_id) VALUES
('ASAMBLEA', 'Asamblea General Ordinaria - Octubre 2026', 'Revisión de cuentas y planificación del trimestre. Todos los comuneros deben asistir.', DATE_ADD(CURDATE(), INTERVAL 7 DAY), '10:00:00', '12:00:00', 'Casa Comunal Junta La Jones - Patate', TRUE, TRUE, 10.00, 'CONVOCADO', 1),
('ASAMBLEA', 'Asamblea Extraordinaria - Elección de Vocales', 'Proceso eleccionario para renovación parcial de la directiva.', DATE_ADD(CURDATE(), INTERVAL 21 DAY), '09:00:00', '11:00:00', 'Casa Comunal Junta La Jones - Patate', TRUE, TRUE, 15.00, 'CONVOCADO', 1),
('MINGA', 'Minga de Limpieza de Canales - Sector La Jones Alta', 'Trabajo comunitario de limpieza y mantenimiento del canal principal del sector La Jones Alta. Traer herramientas.', DATE_ADD(CURDATE(), INTERVAL 14 DAY), '07:00:00', '12:00:00', 'Canal Principal - Sector La Jones Alta', TRUE, TRUE, 8.00, 'CONVOCADO', 1),
('MINGA', 'Minga de Mantenimiento Tanque de Agua', 'Limpieza y revisión del tanque de almacenamiento principal. Obra colectiva.', DATE_ADD(CURDATE(), INTERVAL 28 DAY), '07:00:00', '13:00:00', 'Tanque de Agua Principal - La Jones Alta', TRUE, TRUE, 8.00, 'CONVOCADO', 1)
ON DUPLICATE KEY UPDATE titulo=VALUES(titulo);

-- ==============================================================================
-- PUNTOS DEL ORDEN DEL DÍA (para la primera asamblea)
-- ==============================================================================
INSERT INTO puntos_asamblea (evento_id, orden, punto_tratar, tratado) VALUES
(1, 1, 'Lectura y aprobación del orden del día', FALSE),
(1, 2, 'Informe económico del período julio-septiembre 2026', FALSE),
(1, 3, 'Planificación de mingas para el trimestre octubre-diciembre', FALSE),
(1, 4, 'Revisión de tarifas de agua de riego', FALSE),
(1, 5, 'Puntos varios y ruegos', FALSE)
ON DUPLICATE KEY UPDATE punto_tratar=VALUES(punto_tratar);

-- ==============================================================================
-- OBLIGACIONES PENDIENTES (deudas de algunos comuneros)
-- ==============================================================================
INSERT INTO obligaciones (persona_id, concepto_id, periodo_anio, periodo_mes, fecha_emision, valor, origen, estado, observacion) VALUES
(2, 1, 2026, 9, '2026-09-01', 5.50, 'AUTOMATICA', 'PENDIENTE', 'Cuota agua riego - Septiembre 2026'),
(3, 1, 2026, 9, '2026-09-01', 5.50, 'AUTOMATICA', 'PENDIENTE', 'Cuota agua riego - Septiembre 2026'),
(4, 1, 2026, 9, '2026-09-01', 5.50, 'AUTOMATICA', 'PENDIENTE', 'Cuota agua riego - Septiembre 2026'),
(5, 1, 2026, 8, '2026-08-01', 5.50, 'AUTOMATICA', 'PENDIENTE', 'Cuota agua riego - Agosto 2026'),
(6, 1, 2026, 8, '2026-08-01', 5.50, 'AUTOMATICA', 'PENDIENTE', 'Cuota agua riego - Agosto 2026'),
(2, 2, 2026, 7, '2026-07-15', 10.00, 'AUTOMATICA', 'PENDIENTE', 'Multa por inasistencia a Asamblea - Julio 2026')
ON DUPLICATE KEY UPDATE valor=VALUES(valor);

-- ==============================================================================
-- PAGOS (algunos pagos registrados)
-- ==============================================================================
INSERT INTO pagos (persona_id, fecha_pago, valor_total, metodo, referencia, registrado_por_cuenta_id) VALUES
(1, '2026-09-05 10:00:00', 5.50, 'EFECTIVO', 'REC-001', 1),
(2, '2026-07-03 10:00:00', 5.50, 'EFECTIVO', 'REC-002', 1),
(3, '2026-08-04 10:00:00', 5.50, 'EFECTIVO', 'REC-003', 1),
(7, '2026-09-02 10:00:00', 5.50, 'TRANSFERENCIA', 'TRF-0045', 1);


SET FOREIGN_KEY_CHECKS = 1;
