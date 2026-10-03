# Informe Técnico: Optimización de Contratos y Payloads JSON
**Sistema Integrado de Gestión - Junta de Agua y Riego "La Jones" (Patate)**  
**Fecha:** Octubre 2026  
**Objetivo:** Optimizar los payloads JSON transmitidos entre la API REST (Node.js) y el cliente Angular, eliminando redundancias, minimizando la sobrecarga de red y garantizando contratos fuertemente tipados.

---

## 1. 🔍 Diagnóstico Previo y Oportunidades de Mejora

Durante la auditoría de contratos JSON y consultas SQL, se detectaron las siguientes ineficiencias:

1. **Uso de comodines `SELECT *`:** Varios controladores proyectaban la totalidad de columnas de las tablas, transmitiendo metadatos irrelevantes para la interfaz (e.g. timestamps internos de auditoría) y aumentando el peso de cada respuesta HTTP.
2. **Subconsultas correlacionadas redundantes en Lotes:** El listado de lotes para el mapa satelital ejecutaba **dos subconsultas correlacionadas idénticas por cada terreno** (`(SELECT ... AS propietario)` y `(SELECT ... AS propietarios)`), multiplicando las consultas a la base de datos de manera exponencial ($N \times 2$).
3. **Ejecución repetitiva de DDL en Eventos:** El controlador de eventos invocaba en cada petición HTTP funciones de verificación estructural de tablas (`CREATE TABLE` / `ALTER TABLE`), generando bloqueos innecesarios y latencia en el endpoint público y administrativo.
4. **Ausencia de modelos estrictos en Cliente:** El frontend Angular consumía múltiples endpoints bajo tipo implícito `any`, careciendo de interfaces TypeScript unificadas para validar los contratos de respuesta.

---

## 2. ⚡ Optimizaciones Técnicas Implementadas

### A. Módulo de Comuneros y Personas (`personaController.js`)
- **Proyecciones Específicas:** Se reemplazó la lectura indiscriminada en consultas individuales y listados por proyecciones selectivas de los atributos requeridos (`id`, `cedula`, `nombres`, `apellidos`, `telefono`, `celular`, `email`, `direccion`, `estado`, `lotes_count`).
- **Seguridad en Respuestas:** Se garantizó que en ninguna consulta se incluya accidentalmente atributos sensibles de autenticación (`password_hash`).
- **Paginación Ligera:** Estructuración estandarizada del bloque de metadatos `{ total, page, limit }` sin campos huérfanos.

### B. Módulo de Lotes y Catastro Geográfico (`loteController.js`)
- **Eliminación de Subqueries Correlacionadas:** Se eliminaron las dos subconsultas duplicadas por fila y se implementó un único `LEFT JOIN` con `persona_lotes` y `personas`.
- **Payload Unificado:** La respuesta ahora incluye directamente `{ propietario_id, propietario_cedula, propietario_nombre, propietario }`, reduciendo el tiempo de ejecución en base de datos y el tamaño del paquete JSON enviado al cliente Leaflet.

### C. Módulo de Turnos de Riego (`turnoController.js`)
- **Proyección de Horarios Limpia:** En lugar de `SELECT t.*`, se seleccionan estrictamente los campos del calendario (`id`, `persona_id`, `lote_id`, `dia_semana`, `hora_inicio`, `hora_fin`, `tipo`, `estado`, `observacion`), combinados con los nombres del comunero y lote.

### D. Módulo de Eventos y Asambleas (`eventoController.js`)
- **Memorización en Memoria:** Se implementó una bandera booleana para asegurar la tabla de documentos una sola vez durante el ciclo de vida del proceso Node.js, eliminando la ejecución de 7 consultas DDL por cada petición a `/eventos`.
- **Métricas Compactas:** Cálculo agregado y directo de asistentes y comuneros totales dentro del mismo dataset de respuesta.

---

## 3. 📐 Contratos Tipados en Frontend Angular

Se definió el archivo centralizado `frontend/src/app/core/models/api-payloads.ts` con las siguientes interfaces estándar:

- **`ApiResponse<T>`**: Envoltorio genérico estándar con estado, mensaje y paginación.
- **`PersonaItem`**: Modelo optimizado para listados y padrón de comuneros.
- **`LoteItem`**: Contrato para el mapa interactivo de terrenos y georreferenciación.
- **`TurnoItem`**: Estructura de turnos de distribución del caudal semanal.
- **`EventoItem`**: Contrato de asambleas y mingas con indicadores de participación.
- **`ObligacionItem`**: Estructura financiera sin campos nulos de tarifas intermedias.

---

## 4. 🧪 Validación y Pruebas Automatizadas

Se implementó la suite de pruebas unitarias `backend/test/payloads.test.js` validando:
1. Contrato limpio en listado de comuneros con paginación y sin hashes.
2. Proyección de lotes con sector y propietario sin subqueries redundantes.
3. Entrega precisa de horarios de agua de riego.
4. Correcto cálculo de estadísticas en la lista de eventos.

**Resultado:** **24/24 pruebas unitarias pasando exitosamente** (`npm test`) y **0 errores de compilación** en TypeScript (`npx tsc --noEmit`).
