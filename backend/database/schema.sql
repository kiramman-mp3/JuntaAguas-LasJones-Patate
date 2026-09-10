-- ==============================================================================
-- SISTEMA INTEGRADO DE GESTIÓN - JUNTA DE AGUA Y RIEGO LA JONES (PATATE)
-- ESQUEMA DE BASE DE DATOS ACTUALIZADO (25 TABLAS - DBML VIGENTE)
-- Motor: MySQL 8.0+ / MariaDB 10.5+
-- ==============================================================================

CREATE DATABASE IF NOT EXISTS junta_las_jones CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE junta_las_jones;

SET FOREIGN_KEY_CHECKS = 0;

-- ==============================================================================
-- DOMINIO 1: IDENTIDAD, ACCESO Y ORGANIZACIÓN
-- ==============================================================================

-- 1. Tabla de Personas / Comuneros
CREATE TABLE IF NOT EXISTS personas (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    cedula VARCHAR(10) UNIQUE NOT NULL,
    nombres VARCHAR(100) NOT NULL,
    apellidos VARCHAR(100) NOT NULL,
    direccion VARCHAR(255),
    telefono VARCHAR(30),
    celular VARCHAR(30),
    email VARCHAR(150),
    fecha_nacimiento DATE,
    estado ENUM('ACTIVO', 'INACTIVO') NOT NULL DEFAULT 'ACTIVO',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_personas_apellidos_nombres (apellidos, nombres),
    INDEX idx_personas_nombres_apellidos (nombres, apellidos)
) ENGINE=InnoDB COMMENT='Miembros y comuneros registrados en la Junta de Agua';

-- 2. Tabla de Roles de Acceso
CREATE TABLE IF NOT EXISTS roles (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(30) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    descripcion VARCHAR(255),
    activo BOOLEAN NOT NULL DEFAULT TRUE
) ENGINE=InnoDB COMMENT='Perfiles de acceso al sistema (ADMIN, USUARIO)';

-- 3. Cuentas de Acceso al Software
CREATE TABLE IF NOT EXISTS cuentas (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    persona_id BIGINT UNIQUE NOT NULL,
    rol_id BIGINT NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    debe_cambiar_password BOOLEAN NOT NULL DEFAULT TRUE,
    password_updated_at DATETIME,
    estado ENUM('ACTIVA', 'BLOQUEADA', 'INACTIVA') NOT NULL DEFAULT 'ACTIVA',
    ultimo_acceso DATETIME,
    creada_por_cuenta_id BIGINT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (persona_id) REFERENCES personas(id) ON DELETE CASCADE,
    FOREIGN KEY (rol_id) REFERENCES roles(id),
    FOREIGN KEY (creada_por_cuenta_id) REFERENCES cuentas(id) ON DELETE SET NULL
) ENGINE=InnoDB COMMENT='Credenciales de autenticación y estado de acceso por usuario';

-- 4. Catálogo de Cargos de la Directiva
CREATE TABLE IF NOT EXISTS cargos_directiva (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) UNIQUE NOT NULL,
    orden SMALLINT,
    activo BOOLEAN NOT NULL DEFAULT TRUE
) ENGINE=InnoDB COMMENT='Cargos directivos (Presidente, Vicepresidente, Tesorero, etc.)';

-- 5. Histórico de Miembros de la Directiva
CREATE TABLE IF NOT EXISTS miembros_directiva (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    persona_id BIGINT NOT NULL,
    cargo_id BIGINT NOT NULL,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE,
    estado ENUM('VIGENTE', 'FINALIZADO') NOT NULL DEFAULT 'VIGENTE',
    observacion VARCHAR(255),
    FOREIGN KEY (persona_id) REFERENCES personas(id) ON DELETE CASCADE,
    FOREIGN KEY (cargo_id) REFERENCES cargos_directiva(id),
    INDEX idx_directiva_periodo (persona_id, cargo_id, fecha_inicio)
) ENGINE=InnoDB COMMENT='Historial de períodos directivos de la Junta';

-- ==============================================================================
-- DOMINIO 2: LOTES Y RIEGO
-- ==============================================================================

-- 6. Sectores Geográficos
CREATE TABLE IF NOT EXISTS sectores (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) UNIQUE NOT NULL,
    descripcion VARCHAR(255),
    activo BOOLEAN NOT NULL DEFAULT TRUE
) ENGINE=InnoDB COMMENT='Sectores geográficos de riego en Patate';

-- 7. Terrenos / Lotes
CREATE TABLE IF NOT EXISTS lotes (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    sector_id BIGINT NOT NULL,
    codigo VARCHAR(50) UNIQUE,
    superficie_m2 DECIMAL(12, 2),
    ancho_m DECIMAL(10, 2),
    largo_m DECIMAL(10, 2),
    latitud_aproximada DECIMAL(10, 7),
    longitud_aproximada DECIMAL(10, 7),
    radio_error_m DECIMAL(10, 2),
    referencia_ubicacion VARCHAR(255),
    imagen_url VARCHAR(500),
    observacion TEXT,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (sector_id) REFERENCES sectores(id),
    INDEX idx_lotes_sector (sector_id),
    INDEX idx_lotes_ubicacion_aproximada (latitud_aproximada, longitud_aproximada)
) ENGINE=InnoDB COMMENT='Catálogo de terrenos y lotes con ubicación aproximada';

-- 8. Relación Persona - Lotes (Propiedad / Usufructo M:N)
CREATE TABLE IF NOT EXISTS persona_lotes (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    persona_id BIGINT NOT NULL,
    lote_id BIGINT NOT NULL,
    tipo_relacion ENUM('PROPIETARIO', 'COPROPIETARIO', 'REPRESENTANTE') NOT NULL DEFAULT 'PROPIETARIO',
    porcentaje DECIMAL(5, 2),
    fecha_desde DATE,
    fecha_hasta DATE,
    observacion VARCHAR(255),
    FOREIGN KEY (persona_id) REFERENCES personas(id) ON DELETE CASCADE,
    FOREIGN KEY (lote_id) REFERENCES lotes(id) ON DELETE CASCADE,
    INDEX idx_persona_lotes_relacion (persona_id, lote_id, fecha_desde),
    INDEX idx_persona_lotes_persona (persona_id),
    INDEX idx_persona_lotes_lote (lote_id)
) ENGINE=InnoDB COMMENT='Titularidad, copropiedad y representación de lotes';

-- 9. Turnos y Horarios de Agua de Riego
CREATE TABLE IF NOT EXISTS turnos_riego (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    persona_id BIGINT NOT NULL,
    lote_id BIGINT,
    tipo ENUM('REGULAR', 'ADICIONAL') NOT NULL DEFAULT 'REGULAR',
    dia_semana TINYINT NOT NULL COMMENT '1: Lunes, 7: Domingo',
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL,
    vigencia_desde DATE,
    vigencia_hasta DATE,
    estado ENUM('ACTIVO', 'INACTIVO') NOT NULL DEFAULT 'ACTIVO',
    observacion VARCHAR(255),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (persona_id) REFERENCES personas(id) ON DELETE CASCADE,
    FOREIGN KEY (lote_id) REFERENCES lotes(id) ON DELETE SET NULL,
    INDEX idx_turnos_persona (persona_id),
    INDEX idx_turnos_lote (lote_id),
    INDEX idx_turnos_horario (dia_semana, hora_inicio, hora_fin, estado)
) ENGINE=InnoDB COMMENT='Horarios asignados de agua de riego por comunero y lote';

-- ==============================================================================
-- DOMINIO 3: ASAMBLEAS, MINGAS, ASISTENCIA Y COMUNICACIÓN
-- ==============================================================================

-- 10. Eventos (Asambleas y Mingas)
CREATE TABLE IF NOT EXISTS eventos (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    tipo ENUM('ASAMBLEA', 'MINGA') NOT NULL,
    titulo VARCHAR(200) NOT NULL,
    descripcion TEXT,
    fecha DATE NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fin TIME,
    lugar VARCHAR(255),
    estado ENUM('BORRADOR', 'CONVOCADO', 'REALIZADO', 'CANCELADO') NOT NULL DEFAULT 'BORRADOR',
    requiere_asistencia BOOLEAN NOT NULL DEFAULT TRUE,
    genera_multa_ausencia BOOLEAN NOT NULL DEFAULT TRUE,
    valor_multa DECIMAL(12, 2),
    created_by_cuenta_id BIGINT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by_cuenta_id) REFERENCES cuentas(id),
    INDEX idx_eventos_tipo_fecha (tipo, fecha),
    INDEX idx_eventos_estado_fecha (estado, fecha)
) ENGINE=InnoDB COMMENT='Registro unificado de Asambleas Generales y Mingas Comunitarias';

-- 11. Puntos del Orden del Día y Resoluciones de la Asamblea
CREATE TABLE IF NOT EXISTS puntos_asamblea (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    evento_id BIGINT NOT NULL,
    orden INT NOT NULL,
    punto_tratar TEXT NOT NULL,
    tratado TEXT,
    resolucion TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (evento_id) REFERENCES eventos(id) ON DELETE CASCADE,
    CONSTRAINT uq_puntos_evento_orden UNIQUE (evento_id, orden)
) ENGINE=InnoDB COMMENT='Puntos del orden del día y resoluciones tomadas en asamblea';

-- 12. Registro de Asistencias
CREATE TABLE IF NOT EXISTS asistencias (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    evento_id BIGINT NOT NULL,
    persona_id BIGINT NOT NULL,
    estado ENUM('PENDIENTE', 'PRESENTE', 'AUSENTE', 'JUSTIFICADO') NOT NULL DEFAULT 'PENDIENTE',
    hora_registro DATETIME,
    motivo_justificacion VARCHAR(255),
    registrado_por_cuenta_id BIGINT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (evento_id) REFERENCES eventos(id) ON DELETE CASCADE,
    FOREIGN KEY (persona_id) REFERENCES personas(id) ON DELETE CASCADE,
    FOREIGN KEY (registrado_por_cuenta_id) REFERENCES cuentas(id) ON DELETE SET NULL,
    CONSTRAINT uq_asistencia_evento_persona UNIQUE (evento_id, persona_id),
    INDEX idx_asistencias_persona (persona_id),
    INDEX idx_asistencias_evento_estado (evento_id, estado)
) ENGINE=InnoDB COMMENT='Control de presencia e inasistencia a eventos de la Junta';

-- 13. Documentos de Eventos (Convocatorias, Actas y Resoluciones PDF)
CREATE TABLE IF NOT EXISTS documentos_evento (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    evento_id BIGINT NOT NULL,
    tipo ENUM('CONVOCATORIA', 'ACTA', 'RESOLUCION', 'OTRO') NOT NULL,
    estado ENUM('GENERADO', 'FIRMADO') NOT NULL DEFAULT 'GENERADO',
    nombre_archivo_generado VARCHAR(255) NOT NULL,
    ruta_archivo_generado VARCHAR(500) NOT NULL,
    nombre_archivo_firmado VARCHAR(255),
    ruta_archivo_firmado VARCHAR(500),
    mime_type VARCHAR(100) NOT NULL DEFAULT 'application/pdf',
    visible_publico BOOLEAN NOT NULL DEFAULT FALSE,
    fecha_generacion DATETIME NOT NULL,
    fecha_subida_firmado DATETIME,
    generado_por_cuenta_id BIGINT NOT NULL,
    subido_por_cuenta_id BIGINT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (evento_id) REFERENCES eventos(id) ON DELETE CASCADE,
    FOREIGN KEY (generado_por_cuenta_id) REFERENCES cuentas(id),
    FOREIGN KEY (subido_por_cuenta_id) REFERENCES cuentas(id) ON DELETE SET NULL,
    CONSTRAINT uq_documentos_evento_tipo UNIQUE (evento_id, tipo),
    INDEX idx_documentos_publicos (visible_publico, tipo)
) ENGINE=InnoDB COMMENT='Gestión de PDFs generados y sus versiones firmadas';

-- 14. Notificaciones y Envíos de Convocatorias
CREATE TABLE IF NOT EXISTS envios_convocatoria (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    evento_id BIGINT NOT NULL,
    documento_evento_id BIGINT,
    persona_id BIGINT NOT NULL,
    canal ENUM('WHATSAPP', 'EMAIL') NOT NULL,
    destino VARCHAR(150) NOT NULL,
    estado ENUM('PENDIENTE', 'ENVIADO', 'ERROR') NOT NULL DEFAULT 'PENDIENTE',
    fecha_envio DATETIME,
    proveedor_externo_id VARCHAR(255),
    detalle_error TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (evento_id) REFERENCES eventos(id) ON DELETE CASCADE,
    FOREIGN KEY (documento_evento_id) REFERENCES documentos_evento(id) ON DELETE SET NULL,
    FOREIGN KEY (persona_id) REFERENCES personas(id) ON DELETE CASCADE,
    INDEX idx_envios_evento_persona (evento_id, persona_id),
    INDEX idx_envios_estado (estado)
) ENGINE=InnoDB COMMENT='Trazabilidad de envíos de convocatorias por WhatsApp/Email';

-- ==============================================================================
-- DOMINIO 4: GESTIÓN FINANCIERA
-- ==============================================================================

-- 15. Conceptos de Cobro
CREATE TABLE IF NOT EXISTS conceptos_cobro (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(50) UNIQUE NOT NULL,
    nombre VARCHAR(150) NOT NULL,
    descripcion VARCHAR(255),
    activo BOOLEAN NOT NULL DEFAULT TRUE
) ENGINE=InnoDB COMMENT='Catálogo de rubros cobrables (Agua, Multa Asamblea, Multa Minga)';

-- 16. Tarifas por Período
CREATE TABLE IF NOT EXISTS tarifas (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    concepto_id BIGINT NOT NULL,
    valor DECIMAL(12, 2) NOT NULL,
    vigencia_desde DATE NOT NULL,
    vigencia_hasta DATE,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    observacion VARCHAR(255),
    FOREIGN KEY (concepto_id) REFERENCES conceptos_cobro(id),
    INDEX idx_tarifas_concepto_vigencia (concepto_id, vigencia_desde)
) ENGINE=InnoDB COMMENT='Valores asignados a conceptos por rangos de fecha de vigencia';

-- 17. Cuentas por Cobrar (Obligaciones Financieras Completas - No parciales)
CREATE TABLE IF NOT EXISTS obligaciones (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    persona_id BIGINT NOT NULL,
    concepto_id BIGINT NOT NULL,
    tarifa_id BIGINT,
    evento_id BIGINT,
    periodo_anio SMALLINT,
    periodo_mes TINYINT,
    fecha_emision DATE NOT NULL,
    fecha_vencimiento DATE,
    valor DECIMAL(12, 2) NOT NULL,
    origen ENUM('MANUAL', 'AUTOMATICA') NOT NULL DEFAULT 'MANUAL',
    estado ENUM('PENDIENTE', 'PAGADA', 'ANULADA') NOT NULL DEFAULT 'PENDIENTE',
    observacion VARCHAR(255),
    anulada_por_cuenta_id BIGINT,
    fecha_anulacion DATETIME,
    motivo_anulacion VARCHAR(255),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (persona_id) REFERENCES personas(id),
    FOREIGN KEY (concepto_id) REFERENCES conceptos_cobro(id),
    FOREIGN KEY (tarifa_id) REFERENCES tarifas(id) ON DELETE SET NULL,
    FOREIGN KEY (evento_id) REFERENCES eventos(id) ON DELETE SET NULL,
    FOREIGN KEY (anulada_por_cuenta_id) REFERENCES cuentas(id) ON DELETE SET NULL,
    INDEX idx_obligaciones_persona (persona_id),
    INDEX idx_obligaciones_persona_estado (persona_id, estado),
    INDEX idx_obligaciones_periodo (concepto_id, periodo_anio, periodo_mes),
    INDEX idx_obligaciones_evento (evento_id),
    CONSTRAINT uq_obligacion_persona_periodo UNIQUE (persona_id, concepto_id, periodo_anio, periodo_mes),
    CONSTRAINT uq_multa_persona_evento_concepto UNIQUE (persona_id, evento_id, concepto_id)
) ENGINE=InnoDB COMMENT='Cuentas por cobrar pendientes por comunero (pago completo únicamente)';

-- 18. Registro de Pagos (Ingresos)
CREATE TABLE IF NOT EXISTS pagos (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    persona_id BIGINT NOT NULL,
    fecha_pago DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    valor_total DECIMAL(12, 2) NOT NULL,
    metodo ENUM('EFECTIVO', 'TRANSFERENCIA', 'DEPOSITO', 'OTRO') NOT NULL DEFAULT 'EFECTIVO',
    referencia VARCHAR(100),
    observacion VARCHAR(255),
    registrado_por_cuenta_id BIGINT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (persona_id) REFERENCES personas(id),
    FOREIGN KEY (registrado_por_cuenta_id) REFERENCES cuentas(id),
    INDEX idx_pagos_persona_fecha (persona_id, fecha_pago)
) ENGINE=InnoDB COMMENT='Transacciones de pago realizadas por comuneros';

-- 19. Detalle de Aplicación de Pagos a Obligaciones Completas
CREATE TABLE IF NOT EXISTS pago_detalles (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    pago_id BIGINT NOT NULL,
    obligacion_id BIGINT UNIQUE NOT NULL,
    valor_pagado DECIMAL(12, 2) NOT NULL,
    FOREIGN KEY (pago_id) REFERENCES pagos(id) ON DELETE CASCADE,
    FOREIGN KEY (obligacion_id) REFERENCES obligaciones(id),
    CONSTRAINT uq_pago_obligacion UNIQUE (pago_id, obligacion_id)
) ENGINE=InnoDB COMMENT='Relación entre un pago y las obligaciones canceladas completamente';

-- 20. Registro de Proveedores
CREATE TABLE IF NOT EXISTS proveedores (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    identificacion VARCHAR(20),
    nombre VARCHAR(200) NOT NULL,
    telefono VARCHAR(30),
    direccion VARCHAR(255),
    email VARCHAR(150),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    INDEX idx_proveedores_identificacion (identificacion)
) ENGINE=InnoDB COMMENT='Proveedores o terceros asociados a egresos';

-- 21. Egresos y Gastos
CREATE TABLE IF NOT EXISTS egresos (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    proveedor_id BIGINT,
    fecha DATE NOT NULL,
    concepto VARCHAR(200) NOT NULL,
    descripcion TEXT,
    numero_factura VARCHAR(100),
    archivo_factura VARCHAR(500),
    valor DECIMAL(12, 2) NOT NULL,
    registrado_por_cuenta_id BIGINT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (proveedor_id) REFERENCES proveedores(id) ON DELETE SET NULL,
    FOREIGN KEY (registrado_por_cuenta_id) REFERENCES cuentas(id),
    INDEX idx_egresos_fecha (fecha),
    INDEX idx_egresos_proveedor (proveedor_id)
) ENGINE=InnoDB COMMENT='Registro de gastos, compras y egresos de la Junta';

-- ==============================================================================
-- DOMINIO 5: INVENTARIO
-- ==============================================================================

-- 22. Bienes e Inventario Físico
CREATE TABLE IF NOT EXISTS bienes_inventario (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(50) UNIQUE,
    nombre VARCHAR(150) NOT NULL,
    descripcion TEXT,
    cantidad INT NOT NULL DEFAULT 1,
    valor_unitario DECIMAL(12, 2) NOT NULL,
    fecha_adquisicion DATE,
    estado_fisico VARCHAR(50),
    ubicacion VARCHAR(150),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB COMMENT='Bienes físicos y equipos de la Junta de Agua';

-- ==============================================================================
-- DOMINIO 6: PLANIFICACIÓN ANUAL
-- ==============================================================================

-- 23. Planes Anuales de Trabajo
CREATE TABLE IF NOT EXISTS planes_anuales (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    anio SMALLINT UNIQUE NOT NULL,
    descripcion VARCHAR(255),
    estado ENUM('BORRADOR', 'ACTIVO', 'CERRADO') NOT NULL DEFAULT 'BORRADOR',
    created_by_cuenta_id BIGINT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by_cuenta_id) REFERENCES cuentas(id)
) ENGINE=InnoDB COMMENT='Plan operativo anual institucional';

-- 24. Actividades del Plan Anual
CREATE TABLE IF NOT EXISTS actividades_plan (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    plan_id BIGINT NOT NULL,
    nombre VARCHAR(200) NOT NULL,
    descripcion TEXT,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    estado ENUM('PENDIENTE', 'EN_PROCESO', 'CUMPLIDA', 'NO_CUMPLIDA', 'CANCELADA') NOT NULL DEFAULT 'PENDIENTE',
    fecha_cumplimiento DATE,
    observacion_resultado TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (plan_id) REFERENCES planes_anuales(id) ON DELETE CASCADE,
    INDEX idx_actividades_plan_fechas (plan_id, fecha_inicio, fecha_fin),
    INDEX idx_actividades_plan_estado (estado)
) ENGINE=InnoDB COMMENT='Tareas y actividades específicas para cumplimiento del plan anual';

-- ==============================================================================
-- DOMINIO 7: CONTROL Y AUDITORÍA
-- ==============================================================================

-- 25. Bitácora de Auditoría
CREATE TABLE IF NOT EXISTS auditoria (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    cuenta_id BIGINT,
    accion VARCHAR(50) NOT NULL,
    entidad VARCHAR(100) NOT NULL,
    entidad_id BIGINT,
    fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ip VARCHAR(45),
    detalle JSON,
    FOREIGN KEY (cuenta_id) REFERENCES cuentas(id) ON DELETE SET NULL,
    INDEX idx_auditoria_entidad (entidad, entidad_id),
    INDEX idx_auditoria_cuenta_fecha (cuenta_id, fecha)
) ENGINE=InnoDB COMMENT='Bitácora de auditoría para trazabilidad de cambios';

SET FOREIGN_KEY_CHECKS = 1;

-- ==============================================================================
-- DATOS SEMILLA INICIALES (SEED DATA)
-- ==============================================================================

-- Roles
INSERT INTO roles (codigo, nombre, descripcion) VALUES
('ADMIN', 'Administrador del Sistema', 'Acceso total a todos los módulos y configuración'),
('USUARIO', 'Comunero / Usuario de Riego', 'Acceso a la consulta pública y su portal personal')
ON DUPLICATE KEY UPDATE nombre=VALUES(nombre);

-- Cargos Directivos
INSERT INTO cargos_directiva (nombre, orden) VALUES
('Presidente', 1),
('Vicepresidente', 2),
('Tesorero', 3),
('Secretario', 4),
('Primer Vocal', 5),
('Segundo Vocal', 6)
ON DUPLICATE KEY UPDATE orden=VALUES(orden);

-- Conceptos de Cobro
INSERT INTO conceptos_cobro (codigo, nombre, descripcion) VALUES
('AGUA_MENSUAL', 'Pago Mensual de Agua de Riego', 'Cuota mensual por el uso del servicio de agua'),
('MULTA_ASAMBLEA', 'Multa por Inasistencia a Asamblea', 'Multa generada automáticamente por inasistencia a asamblea'),
('MULTA_MINGA', 'Multa por Inasistencia a Minga', 'Multa generada automáticamente por inasistencia a trabajo comunitario')
ON DUPLICATE KEY UPDATE nombre=VALUES(nombre);
