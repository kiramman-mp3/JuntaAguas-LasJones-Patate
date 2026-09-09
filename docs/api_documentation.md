# 🌐 Documentación de APIs REST & Swagger UI
## Sistema Integrado de Gestión — Junta de Agua y Riego "La Jones" (Patate)

---

## 1. 📌 Introducción y Servidor Base

La API REST del sistema está construida en **Node.js con Express** sobre una base de datos relacional **MySQL**. Proporciona endpoints para la gestión de comuneros, lotes georreferenciados, turnos de agua, asistencias a asambleas/mingas con multas automáticas, recaudación financiera y auditoría.

- **URL Base de la API v1:** `http://localhost:3000/api/v1`
- **Documentación Interactiva Swagger UI:** [`http://localhost:3000/api-docs`](http://localhost:3000/api-docs) (o `http://localhost:3000/api/v1/docs`)
- **Comprobación de Salud (Health Check):** `GET http://localhost:3000/api/health`

---

## 🔑 2. Autenticación y Seguridad

Los endpoints protegidos requieren autenticación mediante **JSON Web Tokens (JWT)**.

- **Formato del Header:**
  ```http
  Authorization: Bearer <su_token_jwt>
  ```
- **Roles del Sistema:**
  - `ADMIN`: Acceso total a todos los módulos y auditoría.
  - `TESORERO`: Acceso a la recaudación de pagos, egresos, tarifas y reporte de balance al día.
  - `SECRETARIO`: Acceso a la gestión de comuneros, lotes, turnos, asambleas y control de asistencias.
  - `USUARIO`: Acceso a la consulta pública y su portal personal.

---

## 📋 3. Resumen de Módulos y Endpoints

### 3.1. 🔐 Autenticación (`/api/v1/auth`)

| Método | Endpoint | Permisos | Descripción |
| :--- | :--- | :--- | :--- |
| `POST` | `/auth/login` | Público | Autenticación mediante cédula y contraseña. Retorna JWT Token y bandera `debeCambiarPassword`. |
| `GET` | `/auth/me` | Autenticado | Devuelve los datos del perfil y rol del usuario autenticado. |
| `POST` | `/auth/change-password` | Autenticado | Permite al usuario modificar su contraseña. |

---

### 3.2. 👤 Comuneros / Personas (`/api/v1/personas`)

| Método | Endpoint | Permisos | Descripción |
| :--- | :--- | :--- | :--- |
| `GET` | `/personas/consulta/:cedula` | **PÚBLICO** | **Endpoint de la Consulta Web:** Busca comunero por cédula y devuelve su lote, sector y todas las obligaciones pendientes y pagadas. |
| `GET` | `/personas` | Autenticado | Listado y búsqueda administrativa de comuneros con paginación (`?busqueda=...&estado=...`). |
| `GET` | `/personas/:id` | Autenticado | Detalle completo de un comunero, incluyendo sus lotes vinculados, turnos y deudas. |
| `POST` | `/personas` | ADMIN / SECRETARIO | Registro de nuevo comunero con opción de creación de cuenta de acceso. |
| `PUT` | `/personas/:id` | ADMIN / SECRETARIO | Actualización de datos personales. |

---

### 3.3. 🗺️ Lotes y Sectores (`/api/v1/lotes`)

| Método | Endpoint | Permisos | Descripción |
| :--- | :--- | :--- | :--- |
| `GET` | `/lotes/sectores` | Público / Autenticado | Catálogo de sectores de riego en Patate. |
| `POST` | `/lotes/sectores` | ADMIN | Crear nuevo sector. |
| `GET` | `/lotes` | Público / Autenticado | Lista de lotes con coordenadas (`latitud_aproximada`, `longitud_aproximada`, `radio_error_m`) y propietarios. |
| `POST` | `/lotes` | ADMIN / SECRETARIO | Crear terreno y asociarlo a un comunero (`persona_lotes`). |
| `POST` | `/lotes/:loteId/vincular-persona` | ADMIN / SECRETARIO | Vincular coppropietario o representante a un lote existente. |

---

### 3.4. 💧 Turnos y Horarios de Agua (`/api/v1/turnos`)

| Método | Endpoint | Permisos | Descripción |
| :--- | :--- | :--- | :--- |
| `GET` | `/turnos` | Público / Autenticado | Horarios de distribución de agua asignados por día de la semana (`1` a `7`) y sector. |
| `POST` | `/turnos` | ADMIN / SECRETARIO | Asignar turno (`REGULAR`/`ADICIONAL`). Valida `hora_inicio < hora_fin` y **no solapamientos**. |

---

### 3.5. 📅 Eventos, Asistencias y Multas (`/api/v1/eventos`)

| Método | Endpoint | Permisos | Descripción |
| :--- | :--- | :--- | :--- |
| `GET` | `/eventos` | Público / Autenticado | Listado de Asambleas y Mingas convocadas y realizadas. |
| `GET` | `/eventos/:id` | Público / Autenticado | Detalle del evento con puntos del orden del día y resoluciones. |
| `POST` | `/eventos` | ADMIN / SECRETARIO | Programar Asamblea o Minga (define `genera_multa_ausencia` y `valor_multa`). |
| `POST` | `/eventos/:id/puntos` | ADMIN / SECRETARIO | Guardar puntos a tratar y resoluciones aprobadas en asamblea. |
| `POST` | `/eventos/:id/asistencias` | ADMIN / SECRETARIO | Toma de asistencia digital (`PRESENTE`, `AUSENTE`, `JUSTIFICADO`). |
| `POST` | `/eventos/:id/finalizar` | ADMIN / SECRETARIO | **Generación Automática de Multas:** Cierra el evento y crea obligaciones de multa para todas las personas ausentes. |

---

### 3.6. 💰 Gestión Financiera & Recaudación (`/api/v1/financiero`)

| Método | Endpoint | Permisos | Descripción |
| :--- | :--- | :--- | :--- |
| `GET` | `/financiero/conceptos` | Público / Autenticado | Catálogo de cobros (`AGUA_MENSUAL`, `MULTA_ASAMBLEA`, `MULTA_MINGA`) y tarifa vigente. |
| `POST` | `/financiero/tarifas` | ADMIN | Registrar o actualizar tarifa para un concepto por rango de vigencia. |
| `GET` | `/financiero/obligaciones` | Autenticado | Cuentas por cobrar pendientes (`?persona_id=...&estado=PENDIENTE`). |
| `POST` | `/financiero/obligaciones` | ADMIN / TESORERO | Emisión de obligación de cobro manual. |
| `POST` | `/financiero/obligaciones/:id/anular` | ADMIN / TESORERO | Anulación de obligación con motivo y registro de auditoría. |
| `POST` | `/financiero/pagos` | ADMIN / TESORERO | **REGISTRO DE PAGO COMPLETO (Transacción sin pagos parciales):** Recibe array de `obligacionesIds`, valida propiedad y cancela las obligaciones en una transacción atómica. |
| `GET` | `/financiero/pagos` | Autenticado | Historial de pagos y recaudación realizada. |
| `GET` | `/financiero/egresos` | Autenticado | Gastos y compras realizadas por la Junta. |
| `POST` | `/financiero/egresos` | ADMIN / TESORERO | Registrar gasto o compra con número de factura. |
| `GET` | `/financiero/balance` | Autenticado | **Reporte de Balance General Al Día:** Suma de Total Ingresos - Total Egresos. |

---

### 3.7. 📦 Inventario, Planificación & Auditoría

| Método | Endpoint | Permisos | Descripción |
| :--- | :--- | :--- | :--- |
| `GET` | `/inventario` | Autenticado | Catálogo de bienes físicos y equipos pertenecientes a la Junta. |
| `POST` | `/inventario` | ADMIN / TESORERO | Registrar nuevo bien en inventario. |
| `GET` | `/planes` | Autenticado | Planes operativos anuales de trabajo y sus actividades asociadas. |
| `POST` | `/planes` | ADMIN | Crear plan anual o añadir actividades con fechas de inicio/fin. |
| `GET` | `/auditoria` | **ADMIN** | Bitácora imborrable de auditoría para trazabilidad de cambios en el sistema. |

---

## 🧪 4. Ejemplos de Payload JSON

### Ejemplo: Consulta Pública por Cédula (`GET /api/v1/personas/consulta/1801234567`)
```json
{
  "status": "OK",
  "resultado": {
    "cedula": "1801234567",
    "nombres": "Juan Carlos Morales Soria",
    "sector": "Sector Las Jones Alto",
    "loteCodigo": "LOT-JONES-A04",
    "totalPendiente": 35.00,
    "deudas": [
      {
        "id": 101,
        "concepto": "Pago Mensual de Agua de Riego",
        "anio": 2026,
        "periodo": "Mes 8",
        "valor": 10.00,
        "estado": "PENDIENTE",
        "fechaEmision": "2026-08-01"
      },
      {
        "id": 103,
        "concepto": "Multa por Inasistencia a Minga",
        "anio": 2026,
        "periodo": "Multa por ausencia a MINGA: Minga de Limpieza Canal Matriz A",
        "valor": 15.00,
        "estado": "PENDIENTE",
        "fechaEmision": "2026-08-22"
      }
    ]
  }
}
```

### Ejemplo: Registro de Pago Completo (`POST /api/v1/financiero/pagos`)
```json
{
  "persona_id": 1,
  "metodo": "EFECTIVO",
  "referencia": "REC-2026-0045",
  "observacion": "Pago completo cuota agua agosto y multa minga",
  "obligacionesIds": [101, 103]
}
```
**Respuesta:**
```json
{
  "status": "OK",
  "message": "Pago registrado exitosamente.",
  "pagoId": 12,
  "valorTotal": 35.00
}
```
