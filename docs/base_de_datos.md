# 🗄️ Documentación del Diseño de la Base de Datos
## Sistema Integrado de Gestión de la Junta de Riego La Jones — Patate

---

## 1. 📌 Introducción

El presente documento describe la arquitectura, criterios de diseño y modelo entidad-relación que rigen la base de datos del **Sistema Integrado de Gestión de la Junta de Riego La Jones**, ubicada en el cantón Patate, provincia de Tungurahua.

El modelo relacional está compuesto por **25 tablas** normalizadas y distribuidas en **7 dominios funcionales**, diseñados para garantizar integridad, flexibilidad, conservación histórica de datos y trazabilidad en los procesos administrativos, financieros y de comunicación de la Junta.

---

## 2. 📐 Criterios Generales de Diseño

1. **Separación entre Persona y Cuenta:** Los datos personales (`personas`) se mantienen independientes de las credenciales de acceso (`cuentas`), donde cada cuenta posee directamente un rol asignado (`rol_id`).
2. **Normalización de Información:** Conceptos repetibles como roles, sectores, conceptos de cobro, tarifas y proveedores se separan en entidades independientes.
3. **Regla de No Pagos Parciales:** Una obligación financiera se cancela completamente (`PAGADA`) o permanece `PENDIENTE`. Un pago cancela una o varias obligaciones completas.
4. **Gestión Documental Completa (PDFs y Firmas):** El sistema conserva tanto el PDF generado originalmente (`GENERADO`) como la versión posteriormente firmada manualmente y cargada (`FIRMADO`).
5. **Automatización de Multas por Ausencia:** Las ausencias no justificadas a eventos de tipo `ASAMBLEA` o `MINGA` generan automáticamente una obligación financiera cuando `genera_multa_ausencia = true`.
6. **Auditoría y Trazabilidad:** Registro centralizado de acciones críticas (crear, modificar, anular, eliminar) en la tabla `auditoria` asociando cuenta responsable, fecha, IP y detalles JSON.

---

## 3. 🗂️ Organización del Modelo por Dominios (25 Tablas)

| Dominio Funcional | Tablas Integrantes | Descripción Breve |
| :--- | :--- | :--- |
| **Identidad, Acceso y Organización** | `personas`, `roles`, `cuentas`, `cargos_directiva`, `miembros_directiva` | Gestión de comuneros, credenciales de acceso, roles (ADMIN/USUARIO) e historial de la directiva. |
| **Lotes y Riego** | `sectores`, `lotes`, `persona_lotes`, `turnos_riego` | Terrenos por sector, ubicación aproximada (lat/lng/radio de error), titularidad y horarios de agua. |
| **Asambleas, Mingas, Asistencia y Comunicación** | `eventos`, `puntos_asamblea`, `asistencias`, `documentos_evento`, `envios_convocatoria` | Eventos, orden del día/resoluciones, control de asistencia, documentos PDF (generados y firmados) y notificaciones (WhatsApp/Email). |
| **Gestión Financiera** | `conceptos_cobro`, `tarifas`, `obligaciones`, `pagos`, `pago_detalles`, `proveedores`, `egresos` | Catálogo de cobros, tarifas con vigencia, cuentas por cobrar (no parciales), pagos, gastos y proveedores. |
| **Inventario** | `bienes_inventario` | Registro y control físico de bienes y herramientas de la Junta. |
| **Planificación Anual** | `planes_anuales`, `actividades_plan` | Plan operativo anual de trabajo y seguimiento de cumplimiento de actividades. |
| **Auditoría** | `auditoria` | Bitácora imborrable de operaciones realizadas por los administradores. |

---

## 📊 Diagrama Entidad-Relación (Mermaid ERD)

```mermaid
erDiagram

    %% --------------------------------------------------
    %% 1. IDENTIDAD, ACCESO Y ORGANIZACIÓN
    %% --------------------------------------------------
    personas ||--o| cuentas : "posee 0..1"
    roles ||--o{ cuentas : "asignado a"
    cuentas ||--o{ cuentas : "crea otras cuentas"
    personas ||--o{ persona_lotes : "se relaciona con"
    personas ||--o{ miembros_directiva : "ejerce cargo"
    cargos_directiva ||--o{ miembros_directiva : "asignado en"

    personas ||--o{ turnos_riego : "asignado turno"
    personas ||--o{ asistencias : "registra asistencia"
    personas ||--o{ obligaciones : "tiene obligaciones"
    personas ||--o{ pagos : "realiza pago"
    personas ||--o{ envios_convocatoria : "recibe notificacion"

    cuentas ||--o{ eventos : "crea"
    cuentas ||--o{ asistencias : "registra"
    cuentas ||--o{ documentos_evento : "genera/sube"
    cuentas ||--o{ obligaciones : "anula"
    cuentas ||--o{ pagos : "registra"
    cuentas ||--o{ egresos : "registra"
    cuentas ||--o{ planes_anuales : "crea"
    cuentas ||--o{ auditoria : "ejecuta accion"

    %% --------------------------------------------------
    %% 2. LOTES Y RIEGO
    %% --------------------------------------------------
    sectores ||--o{ lotes : "contiene"
    lotes ||--o{ persona_lotes : "pertenece a"
    lotes ||--o| turnos_riego : "asociado a 0..N"

    %% --------------------------------------------------
    %% 3. EVENTOS Y COMUNICACIÓN
    %% --------------------------------------------------
    eventos ||--o{ puntos_asamblea : "incluye orden del dia"
    eventos ||--o{ asistencias : "registra participantes"
    eventos ||--o{ documentos_evento : "posee actas/convocatorias"
    eventos ||--o{ envios_convocatoria : "notifica"
    eventos ||--o{ obligaciones : "origina multa"
    documentos_evento ||--o{ envios_convocatoria : "adjunta"

    %% --------------------------------------------------
    %% 4. GESTIÓN FINANCIERA
    %% --------------------------------------------------
    conceptos_cobro ||--o{ tarifas : "define valor por periodo"
    conceptos_cobro ||--o{ obligaciones : "tipo de cobro"
    tarifas ||--o{ obligaciones : "aplica tarifa"
    obligaciones ||--o| pago_detalles : "pagada por 1 detail"
    pagos ||--o{ pago_detalles : "cancela obligaciones"
    proveedores ||--o{ egresos : "factura a la Junta"

    %% --------------------------------------------------
    %% 5. PLANIFICACIÓN ANUAL
    %% --------------------------------------------------
    planes_anuales ||--o{ actividades_plan : "contiene tareas"

    %% --------------------------------------------------
    %% ATRIBUTOS CLAVE POR ENTIDAD
    %% --------------------------------------------------

    personas {
        bigint id PK
        string cedula UK
        string nombres
        string apellidos
        string estado
    }

    cuentas {
        bigint id PK
        bigint persona_id FK_UK
        bigint rol_id FK
        boolean debe_cambiar_password
        string estado
    }

    lotes {
        bigint id PK
        bigint sector_id FK
        string codigo UK
        decimal latitud_aproximada
        decimal longitud_aproximada
        decimal radio_error_m
    }

    turnos_riego {
        bigint id PK
        bigint persona_id FK
        bigint lote_id FK
        string tipo
        tinyint dia_semana
        time hora_inicio
        time hora_fin
    }

    eventos {
        bigint id PK
        string tipo
        string titulo
        date fecha
        boolean genera_multa_ausencia
        decimal valor_multa
    }

    obligaciones {
        bigint id PK
        bigint persona_id FK
        bigint concepto_id FK
        bigint evento_id FK
        decimal valor
        string origen
        string estado
    }

    pagos {
        bigint id PK
        bigint persona_id FK
        datetime fecha_pago
        decimal valor_total
        string metodo
    }

    pago_detalles {
        bigint id PK
        bigint pago_id FK
        bigint obligacion_id FK_UK
        decimal valor_pagado
    }
```

---

## 4. 📚 Detalle Funcional de Tablas y Reglas de Negocio

### 4.1. Dominio de Identidad, Acceso y Organización
- **`personas`**: Miembros de la Junta. La cédula es única y obligatoria.
- **`roles`**: Perfiles de acceso (`ADMIN`, `USUARIO`).
- **`cuentas`**: Credenciales de acceso vinculadas a una persona (`persona_id` es `UNIQUE`). Posee directamete un `rol_id`. Incluye control `debe_cambiar_password`.
- **`cargos_directiva` & `miembros_directiva`**: Mantiene la historia de directivas (Presidente, Tesorero, Secretario, Vocales).

### 4.2. Dominio de Lotes y Riego
- **`sectores`**: Sectores geográficos de riego en Patate.
- **`lotes`**: Terrenos con coordenadas de latitud/longitud aproximadas y radio de error en metros.
- **`persona_lotes`**: Soporta propiedad, copropiedad o representación de lotes.
- **`turnos_riego`**: Asigna horarios de riego a un comunero (`persona_id`), distinguiendo turnos `REGULAR` o `ADICIONAL`.

### 4.3. Dominio de Asambleas, Mingas, Asistencia y Comunicación
- **`eventos`**: Asambleas y Mingas (`tipo`). Define si genera multa por ausencia (`genera_multa_ausencia`).
- **`puntos_asamblea`**: Puntos a tratar, lo tratado y resoluciones tomadas.
- **`asistencias`**: Asistencia por comunero (`PENDIENTE`, `PRESENTE`, `AUSENTE`, `JUSTIFICADO`).
- **`documentos_evento`**: Gestión de PDFs generados (`GENERADO`) y versiones firmadas manualmente (`FIRMADO`).
- **`envios_convocatoria`**: Notificaciones enviadas por WhatsApp o Email.

### 4.4. Dominio Financiero
- **`conceptos_cobro`**: Catálogo (`AGUA_MENSUAL`, `MULTA_ASAMBLEA`, `MULTA_MINGA`).
- **`tarifas`**: Valores con vigencia desde/hasta.
- **`obligaciones`**: Deudas pendientes. **No se permiten pagos parciales**. Origen `MANUAL` o `AUTOMATICA`.
- **`pagos` & `pago_detalles`**: Un pago liquida una o varias obligaciones completas (`obligacion_id` es `UNIQUE` en `pago_detalles`).
- **`proveedores` & `egresos`**: Registro de compras y gastos de la Junta.

### 4.5. Dominio de Inventario, Planificación y Auditoría
- **`bienes_inventario`**: Control físico de activos.
- **`planes_anuales` & `actividades_plan`**: Plan operativo anual (un solo plan activo por año).
- **`auditoria`**: Bitácora inalterable de operaciones críticas.

---

## 🛠️ Tipos de Datos Enumerados (Enums)

| Enum Name | Opciones Válidas |
| :--- | :--- |
| **`estado_persona`** | `ACTIVO`, `INACTIVO` |
| **`estado_cuenta`** | `ACTIVA`, `BLOQUEADA`, `INACTIVA` |
| **`estado_miembro_directiva`** | `VIGENTE`, `FINALIZADO` |
| **`tipo_relacion_lote`** | `PROPIETARIO`, `COPROPIETARIO`, `REPRESENTANTE` |
| **`tipo_turno_riego`** | `REGULAR`, `ADICIONAL` |
| **`estado_turno_riego`** | `ACTIVO`, `INACTIVO` |
| **`tipo_evento`** | `ASAMBLEA`, `MINGA` |
| **`estado_evento`** | `BORRADOR`, `CONVOCADO`, `REALIZADO`, `CANCELADO` |
| **`estado_asistencia`** | `PENDIENTE`, `PRESENTE`, `AUSENTE`, `JUSTIFICADO` |
| **`tipo_documento_evento`** | `CONVOCATORIA`, `ACTA`, `RESOLUCION`, `OTRO` |
| **`estado_documento`** | `GENERADO`, `FIRMADO` |
| **`canal_envio`** | `WHATSAPP`, `EMAIL` |
| **`estado_envio`** | `PENDIENTE`, `ENVIADO`, `ERROR` |
| **`estado_obligacion`** | `PENDIENTE`, `PAGADA`, `ANULADA` |
| **`origen_obligacion`** | `MANUAL`, `AUTOMATICA` |
| **`metodo_pago`** | `EFECTIVO`, `TRANSFERENCIA`, `DEPOSITO`, `OTRO` |
| **`estado_plan`** | `BORRADOR`, `ACTIVO`, `CERRADO` |
| **`estado_actividad_plan`** | `PENDIENTE`, `EN_PROCESO`, `CUMPLIDA`, `NO_CUMPLIDA`, `CANCELADA` |
