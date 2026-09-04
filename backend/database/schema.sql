-- ==============================================================================
-- SISTEMA INTEGRADO DE GESTIÓN - JUNTA DE AGUA Y RIEGO LA JONES (PATATE)
-- ESQUEMA DE BASE DE DATOS COMPLETO Y DOCUMENTADO (26 TABLAS)
-- Motor: MySQL 8.0+ / MariaDB 10.5+
-- ==============================================================================

CREATE DATABASE IF NOT EXISTS junta_las_jones CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE junta_las_jones;

-- Desactivar temporalmente la revisión de claves foráneas para la creación
SET FOREIGN_KEY_CHECKS = 0;

-- ==============================================================================
-- DOMINIO 1: IDENTIDAD Y ORGANIZACIÓN
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
    estado ENUM('ACTIVO', 'INACTIVO') DEFAULT 'ACTIVO',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_personas_cedula (cedula),
    INDEX idx_personas_apellidos_nombres (apellidos, nombres)
) ENGINE=InnoDB COMMENT='Miembros y usuarios registrados en la Junta de Agua';

-- 2. Cuentas de Acceso al Software
CREATE TABLE IF NOT EXISTS cuentas (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    persona_id BIGINT UNIQUE,
    usuario VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    estado ENUM('ACTIVA', 'BLOQUEADA', 'INACTIVA') DEFAULT 'ACTIVA',
    ultimo_acceso DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (persona_id) REFERENCES personas(id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='Credenciales de autenticación para usuarios de la plataforma';

-- 3. Roles del Sistema
CREATE TABLE IF NOT EXISTS roles (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(30) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    descripcion VARCHAR(255),
    activo BOOLEAN DEFAULT TRUE
) ENGINE=InnoDB COMMENT='Roles de permisos del sistema (ADMIN, TESORERO, etc.)';

-- 4. Asignación de Roles a Cuentas (M:N)
CREATE TABLE IF NOT EXISTS cuenta_roles (
    cuenta_id BIGINT NOT NULL,
    rol_id BIGINT NOT NULL,
    asignado_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (cuenta_id, rol_id),
    FOREIGN KEY (cuenta_id) REFERENCES cuentas(id) ON DELETE CASCADE,
    FOREIGN KEY (rol_id) REFERENCES roles(id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='Relación entre usuarios y sus roles asignados';

-- 5. Catálogo de Cargos de la Directiva
CREATE TABLE IF NOT EXISTS cargos_directiva (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    orden SMALLINT DEFAULT 0,
    activo BOOLEAN DEFAULT TRUE
) ENGINE=InnoDB COMMENT='Cargos directivos (Presidente, Vicepresidente, Tesorero, etc.)';

-- 6. Histórico de Miembros de la Directiva
CREATE TABLE IF NOT EXISTS miembros_directiva (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    persona_id BIGINT NOT NULL,
    cargo_id BIGINT NOT NULL,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE,
    estado ENUM('VIGENTE', 'FINALIZADO') DEFAULT 'VIGENTE',
    observacion VARCHAR(255),
    FOREIGN KEY (persona_id) REFERENCES personas(id) ON DELETE CASCADE,
    FOREIGN KEY (cargo_id) REFERENCES cargos_directiva(id)
) ENGINE=InnoDB COMMENT='Historial de directivas de la Junta a través del tiempo';

-- ==============================================================================
-- DOMINIO 2: LOTES Y RIEGO
-- ==============================================================================

-- 7. Sectores Geográficos
CREATE TABLE IF NOT EXISTS sectores (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) UNIQUE NOT NULL,
    descripcion VARCHAR(255),
    activo BOOLEAN DEFAULT TRUE
) ENGINE=InnoDB COMMENT='Sectores geográficos de riego en la Junta La Jones';

-- 8. Terrenos / Lotes
CREATE TABLE IF NOT EXISTS lotes (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    sector_id BIGINT NOT NULL,
    codigo VARCHAR(50) UNIQUE NOT NULL,
    superficie_m2 DECIMAL(12, 2),
    ancho_m DECIMAL(10, 2),
    largo_m DECIMAL(10, 2),
    latitud DECIMAL(10, 7),
    longitud DECIMAL(10, 7),
    referencia_ubicacion VARCHAR(255),
    imagen_url VARCHAR(500),
    observacion TEXT,
    activo BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (sector_id) REFERENCES sectores(id),
    INDEX idx_lotes_sector (sector_id),
    INDEX idx_lotes_coordenadas (latitud, longitud)
) ENGINE=InnoDB COMMENT='Catálogo de terrenos y lotes de riego georreferenciados';

-- 9. Relación Persona - Lotes (M:N, Propiedad / Usufructo)
CREATE TABLE IF NOT EXISTS persona_lotes (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    persona_id BIGINT NOT NULL,
    lote_id BIGINT NOT NULL,
    tipo_relacion ENUM('PROPIETARIO', 'COPROPIETARIO', 'REPRESENTANTE') DEFAULT 'PROPIETARIO',
    porcentaje DECIMAL(5, 2) DEFAULT 100.00,
    fecha_desde DATE,
    fecha_hasta DATE,
    observacion VARCHAR(255),
    FOREIGN KEY (persona_id) REFERENCES personas(id) ON DELETE CASCADE,
    FOREIGN KEY (lote_id) REFERENCES lotes(id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='Titularidad, copropiedad y representación de lotes';

-- 10. Turnos y Horarios de Agua de Riego
CREATE TABLE IF NOT EXISTS turnos_riego (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    lote_id BIGINT NOT NULL,
    dia_semana TINYINT NOT NULL COMMENT '1: Lunes, 7: Domingo',
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL,
    vigencia_desde DATE,
    vigencia_hasta DATE,
    estado ENUM('ACTIVO', 'INACTIVO') DEFAULT 'ACTIVO',
    observacion VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (lote_id) REFERENCES lotes(id) ON DELETE CASCADE,
    INDEX idx_turnos_lote (lote_id),
    INDEX idx_turnos_horarios (dia_semana, hora_inicio, hora_fin)
) ENGINE=InnoDB COMMENT='Horarios asignados de agua de riego por lote';

-- ==============================================================================
-- DOMINIO 3: EVENTOS Y COMUNICACIÓN
-- ==============================================================================

-- 11. Eventos (Asambleas y Mingas)
CREATE TABLE IF NOT EXISTS eventos (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    tipo ENUM('ASAMBLEA', 'MINGA') NOT NULL,
    titulo VARCHAR(200) NOT NULL,
    descripcion TEXT,
    fecha DATE NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fin TIME,
    lugar VARCHAR(255) DEFAULT 'Casa Comunal Junta La Jones',
    estado ENUM('BORRADOR', 'CONVOCADO', 'REALIZADO', 'CANCELADO') DEFAULT 'BORRADOR',
    requiere_asistencia BOOLEAN DEFAULT TRUE,
    genera_multa_ausencia BOOLEAN DEFAULT FALSE,
    valor_multa DECIMAL(12, 2) DEFAULT 0.00,
    created_by_cuenta_id BIGINT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by_cuenta_id) REFERENCES cuentas(id) ON DELETE SET NULL,
    INDEX idx_eventos_fecha (fecha)
) ENGINE=InnoDB COMMENT='Registro unificado de Asambleas Generales y Mingas Comunitarias';

-- 12. Puntos del Orden del Día y Resoluciones de la Asamblea
CREATE TABLE IF NOT EXISTS puntos_asamblea (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    evento_id BIGINT NOT NULL,
    orden INT NOT NULL,
    descripcion TEXT NOT NULL,
    resolucion TEXT,
    estado_cumplimiento VARCHAR(30) DEFAULT 'PENDIENTE',
    observacion_cumplimiento TEXT,
    FOREIGN KEY (evento_id) REFERENCES eventos(id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='Puntos del orden del día y resoluciones tomadas en asamblea';

-- 13. Registro de Asistencias
CREATE TABLE IF NOT EXISTS asistencias (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    evento_id BIGINT NOT NULL,
    persona_id BIGINT NOT NULL,
    estado ENUM('PENDIENTE', 'PRESENTE', 'AUSENTE', 'JUSTIFICADO') DEFAULT 'PENDIENTE',
    hora_registro DATETIME,
    justificada BOOLEAN DEFAULT FALSE,
    motivo_justificacion VARCHAR(255),
    registrado_por_cuenta_id BIGINT,
    UNIQUE KEY uk_evento_persona (evento_id, persona_id),
    FOREIGN KEY (evento_id) REFERENCES eventos(id) ON DELETE CASCADE,
    FOREIGN KEY (persona_id) REFERENCES personas(id) ON DELETE CASCADE,
    FOREIGN KEY (registrado_por_cuenta_id) REFERENCES cuentas(id) ON DELETE SET NULL
) ENGINE=InnoDB COMMENT='Control de presencia e inasistencia a eventos de la Junta';

-- 14. Documentos de Eventos (Convocatorias y Actas PDF)
CREATE TABLE IF NOT EXISTS documentos_evento (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    evento_id BIGINT NOT NULL,
    tipo ENUM('CONVOCATORIA', 'ACTA', 'OTRO') NOT NULL,
    nombre_archivo VARCHAR(255) NOT NULL,
    ruta_archivo VARCHAR(500) NOT NULL,
    mime_type VARCHAR(100) DEFAULT 'application/pdf',
    fecha_generacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    generado_por_cuenta_id BIGINT,
    FOREIGN KEY (evento_id) REFERENCES eventos(id) ON DELETE CASCADE,
    FOREIGN KEY (generado_por_cuenta_id) REFERENCES cuentas(id) ON DELETE SET NULL
) ENGINE=InnoDB COMMENT='Metadatos de documentos digitales en PDF asociados a eventos';

-- 15. Notificaciones y Envíos de Convocatorias
CREATE TABLE IF NOT EXISTS envios_convocatoria (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    evento_id BIGINT NOT NULL,
    documento_evento_id BIGINT,
    persona_id BIGINT NOT NULL,
    canal ENUM('WHATSAPP', 'EMAIL') DEFAULT 'WHATSAPP',
    destino VARCHAR(150) NOT NULL,
    estado ENUM('PENDIENTE', 'ENVIADO', 'ERROR') DEFAULT 'PENDIENTE',
    fecha_envio DATETIME,
    proveedor_externo_id VARCHAR(255),
    detalle_error TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (evento_id) REFERENCES eventos(id) ON DELETE CASCADE,
    FOREIGN KEY (documento_evento_id) REFERENCES documentos_evento(id) ON DELETE SET NULL,
    FOREIGN KEY (persona_id) REFERENCES personas(id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='Registro de envíos masivos de convocatorias por WhatsApp/Email';

-- ==============================================================================
-- DOMINIO 4: FINANZAS
-- ==============================================================================

-- 16. Conceptos de Cobro
CREATE TABLE IF NOT EXISTS conceptos_cobro (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(50) UNIQUE NOT NULL,
    nombre VARCHAR(150) NOT NULL,
    descripcion VARCHAR(255),
    activo BOOLEAN DEFAULT TRUE
) ENGINE=InnoDB COMMENT='Catálogo de conceptos de ingresos (Agua, Multa Asamblea, etc.)';

-- 17. Tarifas por Período
CREATE TABLE IF NOT EXISTS tarifas (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    concepto_id BIGINT NOT NULL,
    valor DECIMAL(12, 2) NOT NULL,
    vigencia_desde DATE NOT NULL,
    vigencia_hasta DATE,
    activo BOOLEAN DEFAULT TRUE,
    observacion VARCHAR(255),
    FOREIGN KEY (concepto_id) REFERENCES conceptos_cobro(id)
) ENGINE=InnoDB COMMENT='Valores asignados a conceptos por rangos de fecha';

-- 18. Cuentas por Cobrar (Obligaciones Financieras)
CREATE TABLE IF NOT EXISTS obligaciones (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    persona_id BIGINT NOT NULL,
    concepto_id BIGINT NOT NULL,
    tarifa_id BIGINT,
    evento_id BIGINT,
    periodo_anio SMALLINT NOT NULL,
    periodo_mes TINYINT,
    fecha_emision DATE NOT NULL,
    fecha_vencimiento DATE,
    valor_original DECIMAL(12, 2) NOT NULL,
    estado ENUM('PENDIENTE', 'PARCIAL', 'PAGADA', 'ANULADA') DEFAULT 'PENDIENTE',
    observacion VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (persona_id) REFERENCES personas(id),
    FOREIGN KEY (concepto_id) REFERENCES conceptos_cobro(id),
    FOREIGN KEY (tarifa_id) REFERENCES tarifas(id) ON DELETE SET NULL,
    FOREIGN KEY (evento_id) REFERENCES eventos(id) ON DELETE SET NULL,
    INDEX idx_obligaciones_persona (persona_id),
    INDEX idx_obligaciones_estado (estado)
) ENGINE=InnoDB COMMENT='Cuentas por cobrar pendientes por comunero';

-- 19. Registro de Pagos (Ingresos)
CREATE TABLE IF NOT EXISTS pagos (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    persona_id BIGINT NOT NULL,
    fecha_pago DATETIME DEFAULT CURRENT_TIMESTAMP,
    valor_total DECIMAL(12, 2) NOT NULL,
    metodo ENUM('EFECTIVO', 'TRANSFERENCIA', 'DEPOSITO', 'OTRO') DEFAULT 'EFECTIVO',
    referencia VARCHAR(100),
    observacion VARCHAR(255),
    registrado_por_cuenta_id BIGINT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (persona_id) REFERENCES personas(id),
    FOREIGN KEY (registrado_por_cuenta_id) REFERENCES cuentas(id) ON DELETE SET NULL
) ENGINE=InnoDB COMMENT='Transacciones de recaudación de dinero en la Junta';

-- 20. Detalle de Aplicación de Pagos (Relación M:N entre Pagos y Obligaciones)
CREATE TABLE IF NOT EXISTS pago_detalles (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    pago_id BIGINT NOT NULL,
    obligacion_id BIGINT NOT NULL,
    valor_aplicado DECIMAL(12, 2) NOT NULL,
    FOREIGN KEY (pago_id) REFERENCES pagos(id) ON DELETE CASCADE,
    FOREIGN KEY (obligacion_id) REFERENCES obligaciones(id)
) ENGINE=InnoDB COMMENT='Desglose de la aplicación de cada pago a obligaciones específicas';

-- 21. Registro de Proveedores
CREATE TABLE IF NOT EXISTS proveedores (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    identificacion VARCHAR(20) UNIQUE NOT NULL,
    nombre VARCHAR(200) NOT NULL,
    telefono VARCHAR(30),
    direccion VARCHAR(255),
    email VARCHAR(150),
    activo BOOLEAN DEFAULT TRUE
) ENGINE=InnoDB COMMENT='Proveedores de servicios, materiales y honorarios';

-- 22. Egresos y Gastos
CREATE TABLE IF NOT EXISTS egresos (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    proveedor_id BIGINT,
    fecha DATE NOT NULL,
    concepto VARCHAR(200) NOT NULL,
    descripcion TEXT,
    numero_factura VARCHAR(100),
    archivo_factura VARCHAR(500),
    valor DECIMAL(12, 2) NOT NULL,
    registrado_por_cuenta_id BIGINT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (proveedor_id) REFERENCES proveedores(id) ON DELETE SET NULL,
    FOREIGN KEY (registrado_por_cuenta_id) REFERENCES cuentas(id) ON DELETE SET NULL
) ENGINE=InnoDB COMMENT='Registro de gastos, compras y pagos efectuados por la Junta';

-- ==============================================================================
-- DOMINIO 5: INVENTARIO
-- ==============================================================================

-- 23. Bienes e Inventario Físico
CREATE TABLE IF NOT EXISTS bienes_inventario (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(50) UNIQUE NOT NULL,
    nombre VARCHAR(150) NOT NULL,
    descripcion TEXT,
    cantidad INT DEFAULT 0,
    valor_unitario DECIMAL(12, 2) DEFAULT 0.00,
    fecha_adquisicion DATE,
    estado_fisico VARCHAR(50) DEFAULT 'BUENO',
    ubicacion VARCHAR(150),
    activo BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB COMMENT='Bienes físicos y equipos pertenecientes a la Junta';

-- ==============================================================================
-- DOMINIO 6: PLANIFICACIÓN ANUAL
-- ==============================================================================

-- 24. Planes Anuales de Trabajo
CREATE TABLE IF NOT EXISTS planes_anuales (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    anio SMALLINT UNIQUE NOT NULL,
    descripcion VARCHAR(255),
    estado ENUM('BORRADOR', 'ACTIVO', 'CERRADO') DEFAULT 'BORRADOR',
    created_by_cuenta_id BIGINT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by_cuenta_id) REFERENCES cuentas(id) ON DELETE SET NULL
) ENGINE=InnoDB COMMENT='Plan operativo anual institucional';

-- 25. Actividades del Plan Anual
CREATE TABLE IF NOT EXISTS actividades_plan (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    plan_id BIGINT NOT NULL,
    nombre VARCHAR(200) NOT NULL,
    descripcion TEXT,
    fecha_inicio DATE,
    fecha_fin DATE,
    estado ENUM('PENDIENTE', 'EN_PROCESO', 'CUMPLIDA', 'NO_CUMPLIDA', 'CANCELADA') DEFAULT 'PENDIENTE',
    fecha_cumplimiento DATE,
    observacion_resultado TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (plan_id) REFERENCES planes_anuales(id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='Tareas y actividades específicas para cumplimiento del plan anual';

-- ==============================================================================
-- DOMINIO 7: CONTROL Y AUDITORÍA
-- ==============================================================================

-- 26. Bitácora de Auditoría
CREATE TABLE IF NOT EXISTS auditoria (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    cuenta_id BIGINT,
    accion VARCHAR(50) NOT NULL COMMENT 'CREAR, MODIFICAR, ANULAR, ELIMINAR',
    entidad VARCHAR(100) NOT NULL COMMENT 'Nombre de la tabla / entidad afectada',
    entidad_id BIGINT,
    fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
    ip VARCHAR(45),
    detalle JSON,
    FOREIGN KEY (cuenta_id) REFERENCES cuentas(id) ON DELETE SET NULL,
    INDEX idx_auditoria_fecha (fecha),
    INDEX idx_auditoria_entidad (entidad, entidad_id)
) ENGINE=InnoDB COMMENT='Bitácora inalterable de auditoría para trazabilidad de cambios';

SET FOREIGN_KEY_CHECKS = 1;

-- ==============================================================================
-- DATOS SEMILLA INICIALES (SEED DATA)
-- ==============================================================================

-- Insertar Roles Principales
INSERT INTO roles (codigo, nombre, descripcion) VALUES
('ADMIN', 'Administrador del Sistema', 'Acceso total a todos los módulos'),
('TESORERO', 'Tesorero de la Junta', 'Gestión de recaudación, egresos e informes financieros'),
('SECRETARIO', 'Secretario de la Junta', 'Gestión de asambleas, actas, asistencias y comuneros'),
('USUARIO', 'Comunero / Usuario de Riego', 'Acceso al portal web para consulta de turnos y pagos')
ON DUPLICATE KEY UPDATE nombre=VALUES(nombre);

-- Insertar Cargos Directivos
INSERT INTO cargos_directiva (nombre, orden) VALUES
('Presidente', 1),
('Vicepresidente', 2),
('Tesorero', 3),
('Secretario', 4),
('Primer Vocal', 5),
('Segundo Vocal', 6)
ON DUPLICATE KEY UPDATE orden=VALUES(orden);

-- Insertar Conceptos de Cobro Básicos
INSERT INTO conceptos_cobro (codigo, nombre, descripcion) VALUES
('AGUA_MENSUAL', 'Pago Mensual de Agua de Riego', 'Cuota mensual obligatoria por uso del servicio de riego'),
('MULTA_ASAMBLEA', 'Multa por Inasistencia a Asamblea', 'Multa generada automáticamente por inasistencia no justificada a asamblea'),
('MULTA_MINGA', 'Multa por Inasistencia a Minga', 'Multa generada automáticamente por inasistencia a trabajos comunitarios')
ON DUPLICATE KEY UPDATE nombre=VALUES(nombre);
