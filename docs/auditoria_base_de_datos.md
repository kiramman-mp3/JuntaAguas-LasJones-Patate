# Informe de Auditoría Técnica: Base de Datos y Modelos
**Sistema Integrado de Gestión - Junta de Agua y Riego "La Jones" (Patate)**  
**Fecha:** Octubre 2026  
**Objetivo:** Auditoría profunda de las 25 tablas y sus atributos para identificar elementos huérfanos, sin consumo real o redundantes, optimizando la mantenibilidad e integridad referencial del sistema.

---

## 1. Metodología de Auditoría

Se realizó un análisis estático de código cruzando las 25 definiciones de tablas en `backend/database/schema.sql` frente a:
1. Toda la capa de persistencia y controladores de la API REST (`backend/src/`).
2. Los servicios y scripts de inicialización/siembra (`initDb.js`, `seedDb.js`).
3. Todos los componentes, páginas e interfaces del cliente Angular (`frontend/src/`).

---

## 2. Matriz de Uso de Tablas del Sistema

| No. | Tabla | Ocurrencias Backend | Ocurrencias Frontend | Estado Operativo | Observación Técnica |
|---|---|---|---|---|---|
| 1 | `personas` | 77 | 6 | **Activa (Crítica)** | Núcleo del padrón de comuneros. |
| 2 | `roles` | 16 | 3 | **Activa (Crítica)** | Control de acceso basado en roles (`ADMIN`, `USUARIO`). |
| 3 | `cuentas` | 26 | 1 | **Activa (Crítica)** | Autenticación y credenciales de acceso. |
| 4 | `cargos_directiva` | 0 | 0 | ❌ **Sin Uso Real** | Catálogo huérfano; la directiva se gestiona por roles. |
| 5 | `miembros_directiva`| 0 | 0 | ❌ **Sin Uso Real** | Histórico no implementado ni consumido por la API/UI. |
| 6 | `sectores` | 23 | 19 | **Activa (Crítica)** | Catastro geográfico y prefijos de código de lote. |
| 7 | `lotes` | 36 | 47 | **Activa (Crítica)** | Georreferenciación, mapa satelital y dimensiones. |
| 8 | `persona_lotes` | 13 | 0 | **Activa (Crítica)** | Titularidad única (`uq_lote_dueno_unico`). |
| 9 | `turnos_riego` | 11 | 0 | **Activa (Crítica)** | Distribución semanal y horaria del caudal de agua. |
| 10 | `eventos` | 49 | 50 | **Activa (Crítica)** | Asambleas Generales y Mingas Comunitarias. |
| 11 | `puntos_asamblea` | 3 | 0 | **Activa** | Orden del día y resoluciones de asamblea. |
| 12 | `asistencias` | 36 | 48 | **Activa (Crítica)** | Toma de lista y liquidación de ausencias. |
| 13 | `documentos_evento`| 27 | 0 | **Activa (Crítica)** | Convocatorias y actas en PDF generadas y firmadas. |
| 14 | `envios_convocatoria`| 3 | 0 | **Activa** | Trazabilidad de notificaciones por WhatsApp. |
| 15 | `conceptos_cobro` | 9 | 0 | **Activa (Crítica)** | Catálogo de rubros cobrables. |
| 16 | `tarifas` | 6 | 0 | **Activa** | Vigencias y valores aplicables por período. |
| 17 | `obligaciones` | 54 | 12 | **Activa (Crítica)** | Cuentas por cobrar y deudas de comuneros. |
| 18 | `pagos` | 26 | 7 | **Activa (Crítica)** | Recaudación en caja y comprobantes. |
| 19 | `pago_detalles` | 7 | 0 | **Activa (Crítica)** | Detalle transaccional de obligaciones liquidadas. |
| 20 | `proveedores` | 1 | 0 | ⚠️ **Candidata a Depuración** | Solo aparece en un LEFT JOIN; no existe CRUD ni registros. |
| 21 | `egresos` | 19 | 21 | **Activa (Crítica)** | Gastos y compras operativas de la Junta. |
| 22 | `bienes_inventario`| 3 | 0 | ⚠️ **Huérfana UI** | Sin pantalla ni consumo en frontend Angular. |
| 23 | `planes_anuales` | 3 | 0 | ⚠️ **Huérfana UI** | Planificación anual sin interfaz de usuario. |
| 24 | `actividades_plan`| 2 | 0 | ⚠️ **Huérfana UI** | Actividades de plan sin interfaz de usuario. |
| 25 | `auditoria` | 9 | 0 | **Activa (Crítica)** | Trazabilidad de operaciones de seguridad en la base. |

---

## 3. Auditoría de Columnas Sin Uso Comprobado

Tras inspeccionar las queries SQL de los controladores, se detectaron las siguientes columnas con 0 usos reales o redundancia técnica:

1. **`lotes.imagen_url`**:
   - *Diagnóstico:* Campo previsto para imagen de escritura o fotografía del lote.
   - *Hallazgo:* No se carga ni se consume en `loteController.js` ni en el visor Leaflet de `lotes-map`.
2. **`persona_lotes.fecha_hasta`**:
   - *Diagnóstico:* Campo para vigencia temporal de tenencia.
   - *Hallazgo:* La Junta de Aguas maneja titularidad exclusiva (`uq_lote_dueno_unico`). No se establecen fechas de vencimiento de dominio sobre el terreno.
3. **`obligaciones.tarifa_id`**:
   - *Diagnóstico:* Clave foránea opcional a la tabla `tarifas`.
   - *Hallazgo:* Los generadores de obligaciones (turnos, mingas, asambleas) asignan el valor y concepto directamente al emitir la obligación. La columna siempre permanece `NULL`.
4. **`documentos_evento.mime_type` y `visible_publico`**:
   - *Diagnóstico:* Columnas secundarias de metadatos.
   - *Hallazgo:* Todos los documentos son obligatoriamente `application/pdf` y las descargas se gestionan mediante base64 o rutas directas.
5. **`envios_convocatoria.proveedor_externo_id`**:
   - *Diagnóstico:* Destinado a IDs devueltos por gateways SMS/Twilio.
   - *Hallazgo:* El envío se realiza mediante sesión web de WhatsApp (`whatsapp-web.js`), por lo que no existe identificador de pasarela externa.

---

## 4. Plan de Acción y Depuración

1. **Fase 1:** Depurar las tablas completamente huérfanas de directiva (`cargos_directiva`, `miembros_directiva`) que no tienen lógica ni controladores.
2. **Fase 2:** Eliminar la dependencia residual de `proveedores` en `egresos` (incorporando proveedor como campo descriptivo directo en egresos si se requiere o retirando el `LEFT JOIN`).
3. **Fase 3:** Retirar las columnas muertas (`tarifa_id`, `imagen_url`, `fecha_hasta`, `proveedor_externo_id`, `documento_evento_id`) en `schema.sql` y scripts de inicialización.
4. **Fase 4:** Validar que la inicialización limpia (`init-db`, `seed-db`) y la suite completa de pruebas unitarias se ejecuten al 100%.

---

## 5. Resultados de la Depuración

- **Total de Tablas Reducido:** De 25 tablas a **22 tablas relacionales activas**.
- **Entidades Eliminadas:**
  - `cargos_directiva`: Removida por redundancia con el sistema de roles RBAC.
  - `miembros_directiva`: Removida por ausencia de lógica y vistas de consumo.
  - `proveedores`: Removida en favor de atributos informativos directos en la tabla `egresos`.
- **Columnas Depuradas:**
  - `lotes.imagen_url`
  - `persona_lotes.fecha_hasta`
  - `obligaciones.tarifa_id`
  - `envios_convocatoria.proveedor_externo_id`
  - `envios_convocatoria.documento_evento_id`
- **Impacto:** Menor sobrecarga en el motor InnoDB, simplificación de claves foráneas, eliminación de JOINS muertos y consistencia total con los controladores de backend y vistas de Angular.
