# 🌐 Documentación de APIs REST & Swagger UI
## Sistema Integrado de Gestión — Junta de Agua y Riego "La Jones" (Patate)

---

## 1. 📌 Introducción y Servidor Base

La API REST del sistema está construida en **Node.js con Express** sobre una base de datos relacional **MySQL**. Proporciona endpoints para la gestión de usuarios registrados como personas, lotes georreferenciados, turnos de agua, asistencias a asambleas/mingas con multas automáticas, recaudación financiera y auditoría.

- **URL Base de la API:** `http://localhost:3000/api`
- **Documentación Interactiva Swagger UI:** [`http://localhost:3000/api-docs`](http://localhost:3000/api-docs) (o `http://localhost:3000/api/docs`)
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
  - `SECRETARIO`: Acceso a la gestión de usuarios, lotes, turnos, asambleas y control de asistencias.
  - `USUARIO`: Acceso a la consulta pública y su portal personal.

---

## 📋 3. Resumen de Módulos y Endpoints

### 3.1. 🔐 Autenticación (`/api/auth`)

| Método | Endpoint | Permisos | Descripción |
| :--- | :--- | :--- | :--- |
| `POST` | `/auth/login` | Público | Autenticación mediante cédula y contraseña. Retorna JWT Token y bandera `debeCambiarPassword`. |
| `GET` | `/auth/me` | Autenticado | Devuelve los datos del perfil y rol del usuario autenticado. |
| `POST` | `/auth/change-password` | Autenticado | Permite al usuario modificar su contraseña. |

---

### 3.2. 👤 Usuarios administrados (personas, `/api/personas`)

| Método | Endpoint | Permisos | Descripción |
| :--- | :--- | :--- | :--- |
| `GET` | `/personas/consulta/:cedula` | **PÚBLICO** | **Endpoint de la Consulta Web:** Busca una persona por cédula y devuelve su lote, sector y todas las obligaciones pendientes y pagadas. |
| `GET` | `/personas` | Autenticado | Listado y búsqueda administrativa de usuarios con paginación (`?busqueda=...&estado=...`). |
| `GET` | `/personas/:id` | Autenticado | Detalle completo de una persona, incluyendo sus lotes vinculados, turnos y deudas. |
| `POST` | `/personas` | ADMIN / SECRETARIO | Registro de un usuario con opción de creación de cuenta de acceso. |
| `PUT` | `/personas/:id` | ADMIN / SECRETARIO | Actualización de datos personales. |

---

### 3.3. 🗺️ Lotes y Sectores (`/api/lotes`)

| Método | Endpoint | Permisos | Descripción |
| :--- | :--- | :--- | :--- |
| `GET` | `/lotes/sectores` | Público / Autenticado | Catálogo de sectores de riego en Patate. |
| `POST` | `/lotes/sectores` | ADMIN | Crear nuevo sector. |
| `GET` | `/lotes` | Autenticado | Lista de lotes con coordenadas (`latitud_aproximada`, `longitud_aproximada`, `radio_error_m`) y propietarios (`?sector_id=...&busqueda=...`). Con `?page=1&limit=25` (máximo 100) devuelve una página y el total en `pagination`; sin `page`, la lista completa. Un usuario solo recibe sus lotes. |
| `POST` | `/lotes` | ADMIN / SECRETARIO | Crear terreno y asociarlo a un usuario (`persona_lotes`). |
| `POST` | `/lotes/:loteId/vincular-persona` | ADMIN / SECRETARIO | Vincular coppropietario o representante a un lote existente. |

---

### 3.4. 💧 Turnos y Horarios de Agua (`/api/turnos`)

| Método | Endpoint | Permisos | Descripción |
| :--- | :--- | :--- | :--- |
| `GET` | `/turnos` | Público / Autenticado | Horarios de distribución de agua asignados por día de la semana (`1` a `7`) y sector. |
| `POST` | `/turnos` | ADMIN / SECRETARIO | Asignar turno semanal. Valida `hora_inicio < hora_fin` y **no solapamientos dentro del sector**. |
| `PUT` | `/turnos/:id` | ADMIN / SECRETARIO | Modificar turno existente (persona, lote, tipo, horario). |
| `DELETE` | `/turnos/:id` | ADMIN / SECRETARIO | Desactivar turno de riego (conserva historial y cancela horario activo). |

---

### 3.5. 📅 Eventos, Asistencias y Multas (`/api/eventos`)

| Método | Endpoint | Permisos | Descripción |
| :--- | :--- | :--- | :--- |
| `GET` | `/eventos` | Público / Autenticado | Listado de Asambleas y Mingas convocadas y realizadas. |
| `GET` | `/eventos/:id` | Público / Autenticado | Detalle del evento con puntos del orden del día y resoluciones. |
| `POST` | `/eventos` | ADMIN / SECRETARIO | Programar Asamblea o Minga (define `genera_multa_ausencia` y `valor_multa`). |
| `POST` | `/eventos/:id/puntos` | ADMIN / SECRETARIO | Guardar puntos a tratar y resoluciones aprobadas en asamblea. |
| `GET` | `/eventos/:id/asistencias` | ADMIN / SECRETARIO | Padrón de asistencia con estados, motivos y metadatos de archivos de justificación adjuntos. |
| `POST` | `/eventos/:id/asistencias` | ADMIN / SECRETARIO | Registro de asistencia continuo (`PRESENTE`, `AUSENTE`, `JUSTIFICADO`). Permanece abierto aún en eventos `REALIZADO` y sincroniza multas ante rectificaciones. |
| `POST` | `/eventos/:id/asistencias/:personaId/justificante` | ADMIN / SECRETARIO | Subir archivo de justificación opcional (PDF, PNG, JPG hasta 10MB) mediante `multipart/form-data`. |
| `GET` | `/eventos/:id/asistencias/:personaId/justificante` | Autenticado | Descargar archivo probatorio de justificación adjunto a la asistencia. |
| `DELETE` | `/eventos/:id/asistencias/:personaId/justificante` | ADMIN / SECRETARIO | Desvincular y eliminar archivo físico de justificación de la asistencia. |
| `POST` | `/eventos/:id/finalizar` | ADMIN / SECRETARIO | **Generación Automática de Multas:** Finaliza el evento y genera obligaciones de multa para ausentes, manteniendo el registro abierto para justificaciones posteriores. |
| `POST` | `/eventos/:id/documentos` | ADMIN / SECRETARIO | Subir documento firmado del evento o de un punto del acta (`multipart/form-data`). |
| `GET` | `/eventos/:id/documentos` | ADMIN / SECRETARIO | Listar metadatos de documentos firmados del evento (sin contenido binario). |
| `GET` | `/eventos/:id/pdf-asistencia` | ADMIN / SECRETARIO | Descargar hoja de asistencia en PDF con padrón de usuarios para firmas físicas. |

---

### 3.6. 💰 Gestión Financiera & Recaudación (`/api/financiero`)

| Método | Endpoint | Permisos | Descripción |
| :--- | :--- | :--- | :--- |
| `GET` | `/financiero/conceptos` | Público / Autenticado | Catálogo de cobros activos (`AGUA_ANUAL`, `MULTA_ASAMBLEA`, `MULTA_MINGA`, `CUOTA_EXTRAORDINARIA`) y tarifa vigente. El agua se cobra una vez al año (`/financiero/agua-anual/*`). |
| `GET` | `/financiero/agua-anual/pagos` | Autenticado | Pagos anuales de agua (un usuario solo ve los suyos). Filtros `desde`, `hasta`, `estado`. |
| `GET` | `/financiero/agua-anual/pagos/:id` | ADMIN / titular | Detalle de un pago anual para reimprimir su comprobante (`REC-AGUA-…`). |
| `POST` | `/financiero/agua-anual/pagos/:id/anular` | ADMIN | Anula un pago anual (motivo obligatorio) y devuelve sus obligaciones a `PENDIENTE`. |
| `POST` | `/financiero/agua-anual/obligaciones/:id/anular` | ADMIN | Anula una obligación anual pendiente (exoneración). |
| `POST` | `/financiero/tarifas` | ADMIN | Registrar o actualizar tarifa para un concepto por rango de vigencia. |
| `GET` | `/financiero/obligaciones` | Autenticado | Cuentas por cobrar pendientes (`?persona_id=...&estado=PENDIENTE`). |
| `POST` | `/financiero/obligaciones` | ADMIN / TESORERO | Emisión de obligación de cobro manual. |
| `POST` | `/financiero/obligaciones/:id/anular` | ADMIN / TESORERO | Anulación de obligación con motivo y registro de auditoría. |
| `POST` | `/financiero/pagos` | ADMIN / TESORERO | **REGISTRO DE PAGO COMPLETO (Transacción sin pagos parciales):** Recibe array de `obligacionesIds`, valida propiedad y cancela las obligaciones en una transacción atómica. |
| `GET` | `/financiero/pagos` | Autenticado | Historial de pagos y recaudación realizada. |
| `POST` | `/financiero/agua-anual/obligaciones` | ADMIN | **Pago anual de agua:** genera la obligación del año (`anio`, `valor_total`) para cada usuario activo. Es idempotente: las obligaciones ya emitidas del año se respetan. |
| `GET` | `/financiero/agua-anual/obligaciones/:personaId` | ADMIN | Obligaciones anuales de agua pendientes de un usuario, de la más antigua a la más reciente. |
| `POST` | `/financiero/agua-anual/pagos` | ADMIN | Registra el pago (solo `TRANSFERENCIA` o `DEPOSITO`, con referencia) de una o varias obligaciones anuales de agua en una transacción atómica. |
| `GET` | `/financiero/egresos` | Autenticado | Gastos y compras realizadas por la Junta. |
| `POST` | `/financiero/egresos` | ADMIN / TESORERO | Registrar gasto o compra con número de factura. |
| `GET` | `/financiero/balance` | Autenticado | **Reporte de Balance General Al Día:** Suma de Total Ingresos (pagos y pagos anuales de agua) - Total Egresos, con la cartera pendiente de ambos. |

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

### 3.8. 💬 WhatsApp y convocatorias (`/api/whatsapp`)

El backend no ejecuta WhatsApp: estas rutas llaman al servicio `whatsapp-service/` (`WHATSAPP_SERVICE_URL`, autenticado con `WHATSAPP_SERVICE_TOKEN`). Si el servicio no responde, devuelven **503** y el resto de la API sigue funcionando.

| Método | Endpoint | Permisos | Descripción |
| :--- | :--- | :--- | :--- |
| `GET` | `/whatsapp/estado` | **ADMIN** | Estado (`DESCONECTADO`, `INICIANDO`, `ESPERANDO_QR`, `CONECTADO`, `NO_DISPONIBLE`, `NO_CONFIGURADO`), QR y grupo elegido. **No inicia WhatsApp.** |
| `POST` | `/whatsapp/sesion/iniciar` | **ADMIN** | Inicia WhatsApp Web; si el teléfono no está vinculado aparece el QR. |
| `POST` | `/whatsapp/sesion/cerrar` | **ADMIN** | Desvincula el teléfono de la Junta (queda en la auditoría). |
| `GET` | `/whatsapp/grupos` | **ADMIN** | Grupos de la cuenta vinculada (`409` si no está conectada). |
| `PUT` | `/whatsapp/grupo` | **ADMIN** | `{ "grupoId": "120363…@g.us" }`: grupo donde se publican las convocatorias. |
| `POST` | `/whatsapp/convocatorias` | **ADMIN** | `{ "eventoId": 12, "reenviar": false }`: publica la convocatoria de una asamblea o minga en el grupo y la deja `CONVOCADO`. |

Respuestas `409` de `POST /whatsapp/convocatorias` con `codigo`:
- `GRUPO_NO_CONFIGURADO`: aún no se eligió el grupo.
- `CONVOCATORIA_YA_ENVIADA`: ya se publicó (incluye `enviadaEn`); repita con `"reenviar": true` para publicarla otra vez.

Sin `codigo`, un `409` indica un evento cancelado, realizado o con fecha pasada. Un `502` indica que WhatsApp rechazó el mensaje (por ejemplo, en un grupo donde solo escriben los administradores).

---

## 🧪 4. Ejemplos de Payload JSON

### Ejemplo: Consulta Pública por Cédula (`GET /api/personas/consulta/1801234567`)
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
        "concepto": "Pago anual de agua",
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

### Ejemplo: Registro de Pago Completo (`POST /api/financiero/pagos`)
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
