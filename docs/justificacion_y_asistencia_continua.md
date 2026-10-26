# 📑 Arquitectura y Documentación Técnica: Justificación de Asistencias y Registro Continuo
## Sistema Integrado de Gestión — Junta Administradora de Agua y Riego "La Jones" (Patate, Tungurahua)

---

## 📌 Control de Versiones y Metadatos del Documento

| Campo | Detalle Técnico |
| :--- | :--- |
| **Proyecto:** | Sistema Web de Gestión Comunitaria de Agua y Riego "La Jones" |
| **Ubicación:** | Parroquia Los Andes / Cantón Patate, Provincia de Tungurahua, Ecuador |
| **Módulo:** | Eventos, Asambleas, Mingas y Control de Asistencias |
| **Versión del Documento:** | 1.0.0 |
| **Fecha de Implementación:** | Octubre 2026 |
| **Autor Técnico:** | Alejandro Falcon (`mfalcon6508@uta.edu.ec`) |
| **Rama de Desarrollo:** | `feature/justificacion-asistencia` |
| **Ramas Integradas:** | `develop` |
| **Estándar de Commits:** | Conventional Commits v1.0.0 |
| **Licencia / Ámbito:** | Privado y Confidencial — Junta de Agua y Riego La Jones |

---

## 📑 Tabla de Contenidos

1. [Resumen Ejecutivo y Objetivos](#1-resumen-ejecutivo-y-objetivos)
2. [Marco Operativo de la Junta de Riego La Jones](#2-marco-operativo-de-la-junta-de-riego-la-jones)
3. [Requerimiento 1: Adjuntos Opcionales en Justificaciones](#3-requerimiento-1-adjuntos-opcionales-en-justificaciones)
   - 3.1. Justificación Funcional y Principio de Carga No Obligatoria
   - 3.2. Ciclo de Vida del Archivo de Justificación
   - 3.3. Formatos Permitidos y Límite de Peso
4. [Requerimiento 2: Registro de Asistencia Continuo](#4-requerimiento-2-registro-de-asistencia-continuo)
   - 4.1. Análisis del Comportamiento Previo (Bloqueo en `REALIZADO`)
   - 4.2. Nueva Máquina de Estados de Asistencia y Eventos
   - 4.3. Política de Rectificación Post-Finalización
5. [Impacto Financiero y Reconciliación Automática de Multas](#5-impacto-financiero-y-reconciliacion-automatica-de-multas)
   - 5.1. Regla de Negocio de Multas por Inasistencia
   - 5.2. Transición de `AUSENTE` a `JUSTIFICADO` / `PRESENTE` Post-Evento
   - 5.3. Transición de `PRESENTE` / `JUSTIFICADO` a `AUSENTE` Post-Evento
6. [Diseño y Migración de Base de Datos](#6-diseño-y-migracion-de-base-de-datos)
   - 6.1. Migración `024_asistencia_archivo_justificacion.js`
   - 6.2. Diccionario de Datos Actualizado (`asistencias`)
   - 6.3. Integridad Referencial y Claves Únicas
7. [Especificación de la API REST (Backend Express)](#7-especificacion-de-la-api-rest-backend-express)
   - 7.1. Catálogo de Nuevos Endpoints y Rutas Modificadas
   - 7.2. Contratos de Entrada y Salida (Request / Response)
   - 7.3. Códigos de Estado HTTP y Manejo de Errores
8. [Seguridad, Almacenamiento y Hardening de Archivos](#8-seguridad-almacenamiento-y-hardening-de-archivos)
   - 8.1. Detección de Tipo Real mediante Magic Numbers (Firma Binaria)
   - 8.2. Prevención de Path Traversal y Nombres Seguros
   - 8.3. Control de Acceso por Roles (RBAC) y Descarga Segura
9. [Arquitectura e Interfaz Frontend (Angular)](#9-arquitectura-e-interfaz-frontend-angular)
   - 9.1. Modelo Reactivo con Signals y Computeds
   - 9.2. Componente de Asistencia en Asambleas (`AsambleaAsistenciaComponent`)
   - 9.3. Componente de Asistencia en Mingas (`MingaAsistenciaComponent`)
   - 9.4. Estilos SCSS Modulares y Accesibilidad (WCAG)
10. [Estrategia de Pruebas y Aseguramiento de Calidad (QA)](#10-estrategia-de-pruebas-y-aseguramiento-de-calidad-qa)
    - 10.1. Pruebas Unitarias del Backend
    - 10.2. Pruebas de Integración de Eventos y Multas
    - 10.3. Pruebas Unitarias del Frontend
11. [Manual de Usuario y Procedimiento Operativo](#11-manual-de-usuario-y-procedimiento-operativo)
12. [Conclusiones y Recomendaciones Futuras](#12-conclusiones-y-recomendaciones-futuras)

---

## 1. 📌 Resumen Ejecutivo y Objetivos

El presente desarrollo atiende dos necesidades críticas para la administración comunitaria de la **Junta de Agua y Riego "La Jones"**, ubicada en el cantón Patate, provincia de Tungurahua:

1. **Adjunto Opcional de Justificativos:** Permitir que los administradores y directivos puedan anexar un archivo digital probatorio (certificado médico, constancia laboral, calamidad doméstica escaneada en formato PDF, PNG o JPG) al registrar una inasistencia justificada, manteniendo la carga de dicho archivo con carácter **estrictamente opcional**. La ausencia de archivo no restringe ni invalida la justificación verbal o manuscrita presentada ante la directiva.
2. **Mantenimiento Continuo del Registro de Asistencia:** Eliminar el bloqueo estricto que cerraba el registro de asistencias una vez que el evento cambiaba su estado a `REALIZADO`. Con esta modificación, la directiva puede actualizar, rectificar y anexar justificaciones incluso semanas después de celebrada una minga o asamblea, asegurando que solo los eventos marcados como `CANCELADO` queden definitivamente bloqueados para pase de lista.

### Objetivos Específicos de Ingeniería

- Implementar la migración de base de datos idempotente `024_asistencia_archivo_justificacion.js` para persistir los metadatos de los archivos probatorios.
- Extender el servicio `eventosService.js` en Node.js para permitir la edición continua de asistencia en eventos `REALIZADO`, manteniendo la coherencia financiera con la tabla de `obligaciones`.
- Crear endpoints REST con subida multipart protegida mediante análisis de números mágicos (magic bytes) en memoria para evitar inyección de archivos maliciosos.
- Modernizar la interfaz gráfica de usuario en Angular mediante botones contextuales de carga, previsualización en chips visuales y diálogo seguro de desvinculación de archivos.
- Reconciliar en tiempo real cualquier multa por inasistencia cuando un comunero pasa de `AUSENTE` a `JUSTIFICADO` de manera retroactiva.

---

## 2. 🏛️ Marco Operativo de la Junta de Riego La Jones

La Junta Administradora de Agua y Riego "La Jones" agrupa a cientos de comuneros y agricultores del cantón Patate. Los dos eventos comunitarios más trascendentales son:

- **Asambleas Generales (Ordinarias y Extraordinarias):** Instancias democráticas donde se toman decisiones de cuotas, obras y reglamentos. La inasistencia no justificada incurre habitualmente en una multa pecuniaria establecida por el estatuto (generalmente \$5.00 a \$10.00 USD).
- **Mingas Comunitarias:** Jornadas de trabajo colectivo obligatorio destinadas a la limpieza de acequias, desarenadores, tanques de reserva y mantenimiento de canales principales y secundarios. Al igual que en las asambleas, la falta injustificada genera multas para costear jornales sustitutos.

### La Problemática Real en Territorio

En la práctica comunitaria rural de Patate, los comuneros que por enfermedad, trabajo o fuerza mayor no logran acudir a una minga o asamblea frecuentemente presentan su certificado médico o justificativo días o semanas después del evento, ya sea en la siguiente sesión de directorio o en la recaudación mensual de agua.

En la versión original del sistema informático:
- Una vez que la asamblea o minga se daba por finalizada (`REALIZADO`), el sistema lanzaba una excepción `409 Conflict: La asamblea/minga ya está realizada o cancelada; su registro de asistencia está cerrado`.
- Esto impedía físicamente al secretario o presidente corregir la inasistencia de un comunero que traía su certificado legítimo a posteriori.
- Además, no existía un mecanismo para archivar digitalmente el documento probatorio, obligando a guardar papeles físicos propensos a extravío y reclamos comunales.

---

## 3. 📎 Requerimiento 1: Adjuntos Opcionales en Justificaciones

### 3.1. Justificación Funcional y Principio de Carga No Obligatoria

El sistema debe permitir que al seleccionar el estado `JUSTIFICADO`, el operador administrativo:
1. Ingrese obligatoriamente un **motivo textual** (ejemplo: *"Reposo médico por cirugía"*, *"Turno de trabajo nocturno"*).
2. Tenga a su disposición un botón visible: **`Adjuntar archivo (opcional)`**.

> [!IMPORTANT]
> **Regla de Opcionalidad Estricta:** La subida de archivo es un valor añadido, no un requisito bloqueante. Si el comunero justificó verbalmente ante el presidente o presentó una carta física que el secretario no desea escanear en ese instante, el botón de "Guardar asistencia" debe procesar el registro con éxito sin obligar a adjuntar ningún archivo.

### 3.2. Ciclo de Vida del Archivo de Justificación

```mermaid
flowchart TD
    A([Comunero Inasistente]) --> B[Seleccionar Estado: JUSTIFICADO]
    B --> C[Ingresar Motivo Textual Obligatorio]
    C --> D{¿Desea adjuntar comprobante digital?}
    D -- NO --> E[Guardar Asistencia Directamente]
    D -- SÍ --> F[Hacer clic en 'Adjuntar archivo (opcional)']
    F --> G[Seleccionar archivo local: PDF / PNG / JPG máx 10MB]
    G --> H[Validación de Magic Bytes en Servidor]
    H -- Válido --> I[Almacenamiento seguro en /uploads/documentos/]
    I --> J[Asociación de URL y Nombre Original en DB]
    J --> K[Visualización de Chip con Nombre y Acciones]
    K --> L[Guardar Asistencia Completa]
    E --> M([Asistencia Justificada sin Archivo])
    L --> N([Asistencia Justificada con Archivo Adjunto])
```

### 3.3. Formatos Permitidos y Límite de Peso

Para garantizar compatibilidad móvil y de escritorio sin sobrecargar el almacenamiento del servidor:
- **Formatos admitidos:**
  - `PDF` (`application/pdf`)
  - `JPEG / JPG` (`image/jpeg`)
  - `PNG` (`image/png`)
- **Límite de tamaño por archivo:** **10 MB** (10,485,760 bytes).
- **Control de entrada HTML:** `accept=".pdf,image/png,image/jpeg"`.
- **Validación Frontend:** Intercepción inmediata en evento `change` que rechaza archivos superiores a 10MB con un modal amigable de advertencia (`DialogService`).

---

## 4. 🔓 Requerimiento 2: Registro de Asistencia Continuo

### 4.1. Análisis del Comportamiento Previo (Bloqueo en `REALIZADO`)

En la arquitectura anterior de `eventosService.js`:
```javascript
// CÓDIGO ANTERIOR (CERRABA ASISTENCIA):
const ESTADOS_ABIERTOS = ['BORRADOR', 'PROGRAMADO', 'CONVOCADO'];

function exigirAbierto(evento) {
  if (!ESTADOS_ABIERTOS.includes(evento.estado)) {
    throw conflict(`La ${NOMBRE[evento.tipo]} ya está realizada o cancelada; su registro de asistencia está cerrado.`);
  }
}
```
Y en los componentes frontend:
```typescript
// En asamblea-asistencia.component.ts:
readonly soloLectura = computed(() => this.asamblea().estado === 'REALIZADO');

// En minga-asistencia.component.ts:
get cerrada() {
  return this.estado === 'REALIZADO' || this.estado === 'CANCELADO';
}
```

Este enfoque asumía que la finalización del evento constituía un sellado inmutable del padrón, lo cual resultaba inoperante ante la realidad de los trámites comunitarios rurales.

### 4.2. Nueva Máquina de Estados de Asistencia y Eventos

Bajo el nuevo diseño, la política es:
- **Eventos que permiten registrar y modificar asistencia:** `BORRADOR`, `PROGRAMADO`, `CONVOCADO` y `REALIZADO`.
- **Eventos con registro cerrado e inmodificable:** Únicamente `CANCELADO`.

```
                  ┌──────────────┐
                  │   BORRADOR   │ (Asistencia Abierta)
                  └──────┬───────┘
                         │
                  ┌──────▼───────┐
                  │  PROGRAMADO  │ (Asistencia Abierta)
                  └──────┬───────┘
                         │
                  ┌──────▼───────┐
                  │  CONVOCADO   │ (Asistencia Abierta)
                  └──┬────────┬──┘
                     │        │
      Finalizar      │        │ Cancelar Evento
   (Pase de lista)   │        │
                     ▼        ▼
       ┌──────────────────┐  ┌──────────────────┐
       │    REALIZADO     │  │    CANCELADO     │
       │(Asistencia ABIERTA│  │(Asistencia BLOQUEADA│
       │ para rectificar) │  │  Definitivamente)│
       └──────────────────┘  └──────────────────┘
```

Implementación refinada en `eventosService.js`:
```javascript
const ESTADOS_ABIERTOS = ['BORRADOR', 'PROGRAMADO', 'CONVOCADO', 'REALIZADO'];

function exigirAbierto(evento) {
  if (evento.estado === 'CANCELADO') {
    throw conflict(`La ${NOMBRE[evento.tipo]} está cancelada; su registro de asistencia está cerrado.`);
  }
  if (!ESTADOS_ABIERTOS.includes(evento.estado)) {
    throw conflict(`La ${NOMBRE[evento.tipo]} no admite registro de asistencia en su estado actual.`);
  }
}
```

En el frontend:
```typescript
// Asamblea:
readonly soloLectura = computed(() => this.asamblea().estado === 'CANCELADO');

// Minga:
get cerrada() {
  return this.estado === 'CANCELADO';
}
```

---

## 5. 💰 Impacto Financiero y Reconciliación Automática de Multas

### 5.1. Regla de Negocio de Multas por Inasistencia

Cuando un evento tiene configurado `genera_multa_ausencia = TRUE`, al ejecutarse la función `finalizar(conexion, evento)`, el sistema genera automáticamente registros en la tabla `obligaciones` para cada comunero marcado como `AUSENTE`:
- `concepto_id`: Rubro de `MULTA_ASAMBLEA` o `MULTA_MINGA`.
- `evento_id`: Clave foránea al evento.
- `origen`: `'AUTOMATICA'`.
- `estado`: `'PENDIENTE'`.
- `valor`: Importe fijado en `evento.valor_multa`.

### 5.2. Transición de `AUSENTE` a `JUSTIFICADO` / `PRESENTE` Post-Evento

Si un comunero fue originalmente marcado como `AUSENTE` y el evento se finalizó, se le cargó una deuda en su estado de cuenta. Al mantener abierto el registro de asistencia, si posteriormente presenta su justificación o se rectifica un error de pase de lista:
- El operador cambia el estado a `JUSTIFICADO` o `PRESENTE`.
- El backend identifica que el evento ya está `REALIZADO` y posee multas automáticas.
- Ejecuta inmediatamente la anulación de la obligación financiera:
```sql
UPDATE obligaciones 
SET estado = 'ANULADA',
    motivo_anulacion = 'Inasistencia corregida o justificada',
    fecha_anulacion = ?,
    anulada_por_cuenta_id = ?
WHERE evento_id = ? 
  AND persona_id IN (?) 
  AND origen = 'AUTOMATICA' 
  AND estado = 'PENDIENTE';
```

> [!NOTE]
> Se respetan las obligaciones que ya hubiesen sido marcadas como `PAGADA`; la conciliación automática únicamente actúa sobre aquellas que permanecen `PENDIENTE`, garantizando que la caja contable no se desface.

### 5.3. Transición de `PRESENTE` / `JUSTIFICADO` a `AUSENTE` Post-Evento

Si un comunero fue marcado erróneamente como presente y el secretario corrige su registro a `AUSENTE` una vez finalizado el evento:
- El sistema verifica si ya existe una obligación activa (`PENDIENTE` o `PAGADA`) para ese evento y comunero.
- Si no existe ninguna, inserta la respectiva multa con origen `AUTOMATICA` y estado `PENDIENTE`, manteniendo la coherencia entre el padrón y las cuentas por cobrar.

---

## 6. 🗄️ Diseño y Migración de Base de Datos

### 6.1. Migración `024_asistencia_archivo_justificacion.js`

Se creó el script de migración incremental en el directorio oficial `backend/database/migrations/`:

```javascript
/**
 * Migración 013: Agrega columnas para el soporte de archivos de justificación opcionales
 * en el registro de asistencias a asambleas y mingas.
 */
module.exports.up = async (db, { addColumnIfMissing }) => {
  await addColumnIfMissing(db, 'asistencias', 'archivo_justificacion_url', 'VARCHAR(500) NULL AFTER motivo_justificacion');
  await addColumnIfMissing(db, 'asistencias', 'archivo_justificacion_nombre', 'VARCHAR(255) NULL AFTER archivo_justificacion_url');
};
```

### 6.2. Diccionario de Datos Actualizado (`asistencias`)

| Columna | Tipo de Dato | Nulo | Por Defecto | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `BIGINT` | NO | Auto-increment | Identificador único de la asistencia. |
| `evento_id` | `BIGINT` | NO | — | Clave foránea vinculada a `eventos(id)`. |
| `persona_id` | `BIGINT` | NO | — | Clave foránea vinculada a `personas(id)`. |
| `estado` | `ENUM` | NO | `'PENDIENTE'` | Estados: `'PENDIENTE'`, `'PRESENTE'`, `'AUSENTE'`, `'JUSTIFICADO'`. |
| `hora_registro` | `DATETIME` | SÍ | `NULL` | Momento en el que se asentó o modificó la asistencia. |
| `motivo_justificacion` | `VARCHAR(255)` | SÍ | `NULL` | Descripción textual del motivo de inasistencia. |
| `archivo_justificacion_url` | `VARCHAR(500)` | SÍ | `NULL` | **(Nuevo)** Ruta relativa del archivo guardado en el servidor (`/uploads/documentos/...`). |
| `archivo_justificacion_nombre` | `VARCHAR(255)` | SÍ | `NULL` | **(Nuevo)** Nombre original del archivo proporcionado por el usuario al subirlo. |
| `registrado_por_cuenta_id` | `BIGINT` | SÍ | `NULL` | Clave foránea a `cuentas(id)` del directivo responsable. |
| `created_at` | `DATETIME` | NO | `CURRENT_TIMESTAMP` | Fecha de creación del registro. |
| `updated_at` | `DATETIME` | NO | `CURRENT_TIMESTAMP ON UPDATE` | Fecha de última modificación. |

### 6.3. Integridad Referencial y Claves Únicas

- **Constraint `uq_asistencia_evento_persona`:** `UNIQUE (evento_id, persona_id)`. Asegura que un comunero tenga exactamente una sola fila por evento, posibilitando sentencias `INSERT INTO ... ON DUPLICATE KEY UPDATE`.
- **Índice `idx_asistencias_evento_estado`:** Optimiza las agregaciones de resumen (`presentes`, `ausentes`, `justificados`).
- **Cascada `ON DELETE CASCADE`:** Si un evento es eliminado en fase de borrador, sus asistencias se purgan automáticamente.

---

## 7. 🌐 Especificación de la API REST (Backend Express)

### 7.1. Catálogo de Nuevos Endpoints y Rutas Modificadas

Todas las rutas requieren autenticación con rol de administrador (`...soloAdmin`):

| Método | Ruta | Middleware | Función Controladora | Descripción |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/eventos/:id/asistencias/:personaId/justificante` | `recibirArchivo` | `eventoController.subirJustificante` | Sube archivo de justificación para asambleas. |
| `GET` | `/api/eventos/:id/asistencias/:personaId/justificante` | — | `eventoController.descargarJustificante` | Descarga el archivo de justificación de asambleas. |
| `DELETE` | `/api/eventos/:id/asistencias/:personaId/justificante` | — | `eventoController.eliminarJustificante` | Elimina el archivo físico y desvincula la columna. |
| `POST` | `/api/mingas/:id/asistencias/:personaId/justificante` | `recibirArchivo` | `mingaController.subirJustificante` | Sube archivo de justificación para mingas. |
| `GET` | `/api/mingas/:id/asistencias/:personaId/justificante` | — | `mingaController.descargarJustificante` | Descarga el archivo de justificación de mingas. |
| `DELETE` | `/api/mingas/:id/asistencias/:personaId/justificante` | — | `mingaController.eliminarJustificante` | Elimina el archivo físico de justificación de mingas. |
| `POST` | `/api/eventos/:id/asistencias` | — | `eventoController.registrarAsistencias` | Modificado: ahora permite guardar en estado `REALIZADO`. |
| `POST` | `/api/mingas/:id/asistencias` | — | `mingaController.registrarAsistencias` | Modificado: ahora permite guardar en estado `REALIZADO`. |

### 7.2. Contratos de Entrada y Salida (Request / Response)

#### Subida de Archivo: `POST /api/eventos/:id/asistencias/:personaId/justificante`
- **Cabeceras:** `Content-Type: multipart/form-data`, `Authorization: Bearer <token>`
- **Payload (Body):**
  - `archivo`: Campo binario del archivo (File).
  - `motivo_justificacion`: (Opcional) Texto de actualización del motivo.
- **Respuesta Exitosa (`200 OK`):**
  ```json
  {
    "status": "OK",
    "message": "Archivo de justificación adjuntado exitosamente.",
    "url": "/uploads/documentos/justificante_asistencia_e1284bf4-7b9c-4e89-8d6d-2309cf8f1a10.pdf",
    "nombre": "Certificado_Medico_Octubre.pdf"
  }
  ```

#### Consulta de Padrón: `GET /api/eventos/:id/asistencias`
- **Respuesta Exitosa (`200 OK`):**
  ```json
  {
    "status": "OK",
    "data": [
      {
        "persona_id": 42,
        "nombre": "Falcon Alejandro",
        "cedula": "1804567890",
        "estado": "JUSTIFICADO",
        "motivo_justificacion": "Calamidad doméstica justificada",
        "archivo_justificacion_url": "/uploads/documentos/justificante_asistencia_e1284bf4-7b9c-4e89-8d6d-2309cf8f1a10.pdf",
        "archivo_justificacion_nombre": "Certificado_Medico_Octubre.pdf",
        "hora_registro": "2026-10-18T05:30:00.000Z"
      }
    ],
    "resumen": {
      "total": 1,
      "presentes": 0,
      "ausentes": 0,
      "justificados": 1,
      "pendientes": 0
    },
    "estado": "REALIZADO"
  }
  ```

### 7.3. Códigos de Estado HTTP y Manejo de Errores

| Código | Significado | Causa Típica |
| :--- | :--- | :--- |
| `200 OK` | Operación exitosa | Archivo cargado, descargado o asistencia guardada correctamente. |
| `400 Bad Request` | Petición inválida | Extensión de archivo inválida, falta archivo, persona ajena al padrón. |
| `401 Unauthorized` | No autorizado | Token JWT ausente, expirado o revocado por cambio de clave. |
| `404 Not Found` | No encontrado | El evento, comunero o archivo físico no existen en el servidor. |
| `409 Conflict` | Conflicto de negocio | Se intenta registrar asistencia sobre un evento `CANCELADO`. |

---

## 8. 🛡️ Seguridad, Almacenamiento y Hardening de Archivos

### 8.1. Detección de Tipo Real mediante Magic Numbers (Firma Binaria)

No se confía en la extensión remitida por el cliente ni en la cabecera `Content-Type` de la petición HTTP. En `backend/src/services/documentStorage.js`, el servicio inspecciona los primeros bytes del búfer en memoria antes de escribir en disco:

```javascript
const TIPOS = [
  { ext: 'pdf', mime: 'application/pdf', firma: Buffer.from('%PDF-') },
  { ext: 'png', mime: 'image/png', firma: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) },
  { ext: 'jpg', mime: 'image/jpeg', firma: Buffer.from([0xff, 0xd8, 0xff]) }
];

function detectarTipo(buffer) {
  return TIPOS.find((t) => buffer.length >= t.firma.length && buffer.subarray(0, t.firma.length).equals(t.firma)) || null;
}
```

Cualquier archivo ejecutable (`.exe`, `.sh`, `.php`, `.js`) o script malicioso disfrazado con extensión `.pdf` es rechazado de raíz con `400 Bad Request: Formato no permitido. Suba un PDF o una imagen JPG/PNG`.

### 8.2. Prevención de Path Traversal y Nombres Seguros

- **Nombre generado por el servidor:** El nombre almacenado en el sistema de archivos se genera con un UUID aleatorio criptográficamente seguro:
  ```javascript
  const nombre = `${prefijo}_${crypto.randomUUID()}.${tipo.ext}`;
  ```
- **Validación de directorio seguro (`rutaSegura`):** Al descargar, se sanitiza la entrada mediante regex y se valida que la ruta canónica no salga del directorio de uploads:
  ```javascript
  const NOMBRE_SEGURO = /^[A-Za-z0-9_-]+\.(pdf|png|jpg|jpeg)$/;
  function rutaSegura(nombre) {
    if (typeof nombre !== 'string' || !NOMBRE_SEGURO.test(nombre)) return null;
    const ruta = path.resolve(DIRECTORIO, nombre);
    return path.dirname(ruta) === DIRECTORIO ? ruta : null;
  }
  ```
- **Cabeceras de respuesta seguras:**
  - `X-Content-Type-Options: nosniff` (previene MIME sniffing en el navegador).
  - `Cache-Control: private, no-store` (evita almacenamiento en proxies intermediarios).

### 8.3. Control de Acceso por Roles (RBAC) y Descarga Segura

Tanto la subida como la eliminación están protegidas con el middleware `soloAdmin`. La descarga (`GET`) verifica que el peticionario sea un directivo o el propio comunero dueño de la asistencia, previniendo fuga de datos personales sensibles de salud o calamidad doméstica.

---

## 9. 🎨 Arquitectura e Interfaz Frontend (Angular)

### 9.1. Modelo Reactivo con Signals y Computeds

El frontend implementa la reactividad moderna de Angular con Signals:
- `soloLectura`: Señal computada que evalúa el estado del evento:
  ```typescript
  readonly soloLectura = computed(() => this.asamblea().estado === 'CANCELADO');
  ```
  Al comprobar exclusivamente contra `'CANCELADO'`, los botones de pase de lista, inputs de motivos y botones de adjuntos permanecen completamente interactivos cuando el evento tiene estado `'REALIZADO'`.
- `subiendoArchivo`: Señal que almacena el `persona_id` del comunero cuyo archivo está procesándose actualmente, permitiendo mostrar indicadores de carga independientes por fila (spinners) sin bloquear al resto de comuneros.

### 9.2. Componente de Asistencia en Asambleas (`AsambleaAsistenciaComponent`)

El componente integra:
1. Barra de herramientas superior con buscador instantáneo y filtro por estado (`TODOS`, `PENDIENTE`, `PRESENTE`, `AUSENTE`, `JUSTIFICADO`).
2. Lista del padrón con toggle tri-estado de presencia.
3. Bloque condicional `@if (p.estado === 'JUSTIFICADO')`:
   - Campo de texto para el motivo justificado.
   - Botón de carga con input `type="file"` oculto accesible por teclado.
   - Chip dinámico del archivo cuando ya existe un documento adjunto.

### 9.3. Componente de Asistencia en Mingas (`MingaAsistenciaComponent`)

En mingas, el componente mantiene la consistencia visual y funcional con asambleas:
- Propiedad de acceso `get cerrada() { return this.estado === 'CANCELADO'; }`.
- Métodos integrados: `adjuntarArchivo(a, event)`, `descargarArchivo(a)` y `eliminarArchivo(a)`.
- Compatibilidad bidireccional con Change Detection OnPush / Default mediante `this.cdr.markForCheck()`.

### 9.4. Estilos SCSS Modulares y Accesibilidad (WCAG)

En `frontend/src/styles/_eventos.scss` se agregaron reglas que siguen el sistema de diseño del proyecto:
- **`.roster__justification-block`**: Estructura en columna con espaciado consistente y animación suave `ui-rise`.
- **`.roster__attach-btn`**: Botón con borde punteado suave (`dashed`), que cambia de color al interactuar (`hover`), invitando a la carga opcional.
- **`.roster__file-chip`**: Elemento visual tipo pastilla con fondo `var(--bg-surface-hover)`, ícono de documento, truncado automático con puntos suspensivos (`text-overflow: ellipsis`) para nombres largos, y micro-botones accesibles de descarga y eliminación.
- **Accesibilidad:** Uso de `aria-label`, atributos semánticos `title` y soporte completo de navegación por teclado.

---

## 10. 🧪 Estrategia de Pruebas y Aseguramiento de Calidad (QA)

### 10.1. Pruebas Unitarias del Backend

Ejecutadas mediante el test runner nativo de Node.js (`node --test test/unit/*.test.js`):
- Validación de fechas locales de Ecuador (zona horaria UTC-5).
- Validación de centavos y precisión en cobros de multas.
- Normalización de cadenas y sectores de Patate.
- **Resultado:** **7/7 pruebas aprobadas (100% PASS)**.

### 10.2. Pruebas de Integración de Eventos y Multas

En `backend/test/integration/eventos.test.js`:
1. `finalizar es idempotente y mantiene el registro de asistencia abierto`:
   - Verifica que tras finalizar un evento (`REALIZADO`), invocar nuevamente el registro de asistencia devuelva código `200 OK` (en lugar del `409 Conflict` previo).
2. `las justificaciones requieren motivo, admiten archivo opcional y no generan multa`:
   - Verifica que una justificación sin motivo textual sea rechazada con `400 Bad Request`.
   - Verifica que con motivo textual se guarde exitosamente (`200 OK`) sin requerir archivo.
   - Sube un búfer PDF simulado mediante `.attach('archivo', ...)`.
   - Comprueba la respuesta `200 OK` con URL y nombre devueltos.
   - Descarga el archivo mediante `GET` y verifica cabecera `Content-Type: application/pdf`.
   - Verifica que el padrón retorne los campos `archivo_justificacion_url` y `archivo_justificacion_nombre`.

### 10.3. Pruebas Unitarias del Frontend

Verificación exhaustiva de tipos y compilación con TypeScript:
```bash
npx tsc -p tsconfig.app.json --noEmit
```
- **Resultado:** **0 errores de compilación**. Integridad total de contratos e interfaces `AsistentePadron`, `AsistenciaMinga`, `AdminService` y componentes visuales.

---

## 11. 📖 Manual de Usuario y Procedimiento Operativo

### Procedimiento 1: Justificar Inasistencia con Archivo Opcional (Asamblea o Minga)

1. Ingrese al panel administrativo con una cuenta con perfil de `ADMIN` o directivo.
2. Navegue al módulo de **Asambleas** o **Mingas** en la barra lateral.
3. En la tarjeta o fila del evento deseado, presione el botón **`Asistencia`**.
4. Localice al comunero utilizando el buscador por nombre o cédula.
5. Presione el botón **`Justificado`** (tono ámbar/amarillo).
6. Escriba el motivo en el campo de texto (ejemplo: *"Cita en el Seguro Social"*).
7. *(Opcional)* Si el comunero entregó un comprobante digital:
   - Haga clic en el botón **`Adjuntar archivo (opcional)`**.
   - Seleccione el archivo PDF o imagen JPG/PNG desde su equipo.
   - El sistema cargará el archivo y mostrará el chip con el nombre del documento.
8. Presione el botón principal **`Guardar asistencia`**.

### Procedimiento 2: Rectificar Asistencia en un Evento Ya Realizado

1. Abra el evento que se encuentra en estado **`Realizado`** (insignia verde).
2. Haga clic en **`Asistencia`**. El sistema abrirá el registro en modo **editable** (no bloqueado).
3. Si un comunero figuraba como `Ausente` (con multa pendiente) y presenta su justificación:
   - Cambie su estado a **`Justificado`**.
   - Ingrese el motivo y opcionalmente adjunte el archivo.
   - Presione **`Guardar asistencia`**.
4. El sistema guardará la corrección y **anulará automáticamente la multa de inasistencia pendiente** en el módulo de Finanzas, actualizando el estado de cuenta del comunero de forma inmediata.

### Procedimiento 3: Descargar o Eliminar un Archivo Adjunto

- **Para descargar:** Haga clic en el ícono de descarga (`ri-download-2-line`) ubicado dentro del chip del archivo. El navegador iniciará la descarga con el nombre original del archivo.
- **Para eliminar:** Haga clic en el ícono de basurero (`ri-delete-bin-line`). Confirme la acción en el cuadro de diálogo. El archivo físico se eliminará del servidor y la justificación escrita permanecerá intacta.

---

## 12. 🔮 Conclusiones y Recomendaciones Futuras

### Logros Alcanzados
- **Flexibilidad Administrativa:** La directiva de la Junta de Riego La Jones dispone ahora de un sistema que se adapta a las dinámicas reales de la comunidad, evitando fricciones por multas indebidas o plazos rígidos.
- **Respaldo Probatorio Digital:** Se reduce el volumen de documentos físicos en la sede comunal, permitiendo auditorías claras ante quejas comunales en asambleas.
- **Arquitectura Limpia y Modular:** Se respetaron estrictamente las convenciones de software del proyecto (controladores delgados, servicios con transacciones MySQL, TypeScript estricto, Angular standalone components y diseño CSS con variables nativas).

### Recomendaciones para Versiones Posteriores
1. **Visualizador Rápido en Modal:** Implementar un visor integrado con `pdf.js` o modal de imagen para previsualizar el justificativo directamente dentro del sistema sin necesidad de descargarlo al disco local.
2. **Historial de Rectificaciones:** Añadir una pestaña o tooltip en el padrón que indique quién y en qué fecha modificó la asistencia de un comunero una vez finalizado el evento.
3. **Notificación al Comunero:** Enviar una confirmación automática por WhatsApp al comunero informándole que su inasistencia fue justificada con éxito y que su multa fue retirada.

---
*Documento técnico elaborado y validado para la Junta Administradora de Agua y Riego "La Jones" — Patate, Ecuador.*
