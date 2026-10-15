# Guía Maestra de Presentación y Defensa del Proyecto
## Sistema Integrado de Gestión — Junta de Agua y Riego "La Jones" (Patate, Tungurahua)

Esta guía proporciona el guión estructurado, credenciales, flujo en vivo y argumentos técnicos para presentar y defender con éxito el proyecto ante evaluadores, docentes o directivos.

---

## 1. Ficha Resumen del Proyecto

| Parámetro | Detalle |
|---|---|
| **Institución / Caso de estudio** | Junta de Agua Potable y Riego "La Jones" (Cantón Patate, Provincia de Tungurahua, Ecuador). |
| **Población Objetivo** | ~120 comuneros activos distribuidos en 4 sectores territoriales. |
| **Problema que resuelve** | Reemplaza el registro manual en cuadernos y hojas de cálculo por una plataforma web segura, auditada y en tiempo real para el control de comuneros, catastro de lotes, turnos de riego, asistencias con multas automáticas, cobranza en caja con comprobantes PDF y consulta transparente para cada comunero. |
| **Arquitectura** | Monorepo desacoplado: Frontend SPA (Angular 22), Backend REST (Node.js 26 + Express 5), Base de datos relacional (MySQL 8) y Microservicio auxiliar de mensajería (WhatsApp Web). |
| **Calidad y Cobertura** | **256 pruebas automáticas superadas con éxito** (109 backend contra MySQL real, 122 frontend con Vitest, 25 servicio de WhatsApp) y 0 errores de compilación o linter. |

---

## 2. Accesos Rápidos y Credenciales de Demostración

La base de datos se encuentra sembrada con **2 años de historia operativa realista** (~122 comuneros, 190 lotes, 2615 cuotas, 30 eventos, 1824 pagos y 34 egresos).

| Rol | Cédula | Contraseña | URL | Propósito en la demo |
|---|---|---|---|---|
| **Administrador** (Presidente) | `1823661267` *(Carlos Eduardo Moreta Salazar)* | `Junta2026` | `http://localhost:4200/login` | Control total del sistema, dashboard, finanzas, catastro, actas y turnos. |
| **Comunero** (Usuario) | `1809198243` *(Beatriz Elena Viteri Mayorga)* | `Junta2026` | `http://localhost:4200/login` | Demostrar el portal del comunero (`/mi-cuenta`): consulta de deuda, lotes y turnos. |
| **Portal Público** | Sin autenticación | — | `http://localhost:4200/eventos` | Convocatorias y calendario de asambleas/mingas visible para toda la comunidad. |
| **Documentación API** | Swagger UI | — | `http://localhost:3000/api-docs` | Demostración de contratos OpenAPI, schemas Zod y endpoints REST. |

---

## 3. Cómo Iniciar la Demostración

### En Windows (1 solo paso):
Haga doble clic en el archivo **`presentar.bat`** en la raíz del proyecto, o ejecute desde la terminal:
```bash
npm run dev
```
Este comando verificará la base de datos MySQL en Docker, levantará el backend en el puerto `3000`, compilará y servirá el frontend de Angular en el puerto `4200`, y abrirá el navegador automáticamente.

---

## 4. Guión de Presentación en Vivo (7 a 10 Minutos)

Siga este orden cronológico para una demostración fluida, impactante y coherente:

### Etapa 1: Contexto y Portal Público (1 min)
1. Abrir `http://localhost:4200`.
2. Explicar brevemente la problemática de las juntas rurales de agua en el Ecuador (pérdida de recaudación, disputas por turnos de riego, falta de transparencia en multas).
3. Entrar a **Eventos** (`/eventos`): mostrar que el público y comuneros pueden consultar las próximas asambleas y mingas con sus documentos oficiales adjuntos, **sin exponer jamás cédulas ni datos personales protegidos**.

### Etapa 2: Acceso Seguro y Dashboard Gerencial (2 min)
1. Ingresar en `/login` con las credenciales de Administrador (`1823661267` / `Junta2026`).
2. Mostrar el **Dashboard** (`/admin/dashboard`):
   - **Indicadores reales:** Recaudado del mes, saldo en caja, cartera por cobrar, morosidad acumulada, porcentaje de asistencia a eventos.
   - Explicar que todos los números provienen de consultas SQL optimizadas sobre transacciones reales de la base de datos (no son contadores hardcodeados).

### Etapa 3: Catastro de Lotes y Padrón de Comuneros (2 min)
1. Navegar a **Comuneros & Lotes** (`/admin/comuneros`):
   - Padrón: Búsqueda reactiva por cédula o nombre.
   - Catastro: Mostrar la ficha de lotes con códigos normalizados por sector (`SEC1-001`, `SEC2-015`).
   - Mapa interactivo Leaflet: Visualización de los lotes georreferenciados sobre el mapa de Patate.
   - **Regla de oro de negocio:** Enfatizar que un lote pertenece al 100% a un único titular, y demostrar la transferencia de dominio con auditoría histórica (quién transfirió a quién y en qué fecha).

### Etapa 4: Asambleas, Mingas y Multas Automáticas (2 min)
1. Navegar a **Asistencias** (`/admin/asistencias`):
   - Mostrar cómo se crea una convocatoria con orden del día desglosado por puntos.
   - Abrir el padrón de asistencia de un evento: estados Presente, Falta y Justificado.
   - **Punto fuerte de negocio:** Al presionar *Finalizar Evento*, el sistema aplica automáticamente las multas a todos los inasistentes sin que el recaudador las digite a mano, basándose en la tarifa oficial vigente en esa fecha.
   - Demostrar la descarga instantánea del **Acta Oficial** y la **Hoja de Asistencia en PDF** generada desde el cliente con formato institucional.

### Etapa 5: Turnos de Riego sin Solapes (1 min)
1. Navegar a **Turnos** (`/admin/turnos`):
   - Visualizar la matriz de turnos semanales por sector.
   - Explicar la validación algorítmica: el sistema impide que dos comuneros compartan el mismo canal en el mismo horario.
   - Mostrar la opción de asignar *Turno Adicional*, el cual genera automáticamente una obligación financiera para cobro en caja.

### Etapa 6: Finanzas, Facturación Masiva y Cobro en Caja (2 min)
1. Navegar a **Cobro en Caja** (`/admin/finanzas/cobrar`):
   - Buscar un comunero (ej. escribir `Beatriz` o cédula `1809198243`).
   - El sistema lista instantáneamente sus deudas consolidadas: cuotas mensuales de agua, multas de mingas, multas de asambleas.
   - Seleccionar rubros a cancelar, elegir método (Efectivo / Transferencia con número de comprobante) y pulsar *Registrar Cobro*.
   - Se genera el **Comprobante de Pago en PDF** con numeración consecutiva, desglose de ítems y sellos.
2. Mostrar **Facturación Mensual** (`/admin/finanzas/facturacion`):
   - Matriz mes a mes del año. Con un solo clic se emite la cuota a todos los comuneros activos con lote, garantizando idempotencia (no se duplica si ya fue emitida).
3. Mostrar **Historial y Anulación** (`/admin/finanzas/pagos`):
   - Si un pago fue registrado por error, se puede anular con un motivo justificado; las obligaciones asociadas vuelven al estado pendiente de forma atómica.

### Etapa 7: Portal del Comunero — La Prueba de la Transparencia (1 min)
1. Cerrar sesión del administrador.
2. Iniciar sesión como comunero (`1809198243` / `Junta2026`).
3. Entrar a **Mi Cuenta** (`/mi-cuenta`):
   - El comunero visualiza únicamente sus propios lotes, turnos asignados, valores adeudados y su historial de pagos con posibilidad de reimprimir sus comprobantes.
   - Enfatizar el principio de menor privilegio: el backend rechaza cualquier petición a datos ajenos, incluso manipulando el ID en la petición HTTP.

---

## 5. Preguntas Clave del Jurado y Respuestas de Defensa

### P1: "¿Cómo garantizan que no haya dinero descuadrado ni errores de redondeo en JavaScript?"
> **Respuesta:** En JavaScript `0.1 + 0.2 !== 0.3` debido a la aritmética de coma flotante IEEE 754. Para evitar cualquier inconsistencia, el sistema almacena y procesa internamente todas las operaciones financieras en **centavos enteros** (números enteros en backend y base de datos) mediante un módulo centralizado (`dinero.js`). La conversión a formato decimal con dos dígitos (`$1.50`) se realiza únicamente al renderizar en la vista o en los reportes PDF.

### P2: "¿Qué ocurre ante fallos concurrentes o peticiones simultáneas de cobro?"
> **Respuesta:** Toda operación de cobro, facturación masiva y transferencia de lotes se ejecuta dentro de **transacciones ACID estrictas** en MySQL (`BEGIN ... COMMIT / ROLLBACK`) a través de un wrapper seguro (`transaction.js`). Si falla la generación de un recibo o la actualización de un saldo, se revierte la transacción completa para impedir estados huérfanos o dobles cobros.

### P3: "¿Cómo manejan la diferencia entre la hora UTC del servidor y la hora de Ecuador?"
> **Respuesta:** El cantón Patate opera en la zona horaria UTC-5. Los instantes de auditoría (ej. `creado_en`) se persisten en UTC estándar. Sin embargo, las fechas de calendario (asambleas, períodos de facturación y turnos) viajan y se validan en formato ISO `AAAA-MM-DD`, y los filtros por día en reportes de caja utilizan el calendario de Ecuador (`shared/fechasEcuador.js`), evitando que un pago de las 8:00 PM aparezca registrado con la fecha del día siguiente.

### P4: "¿Qué pasa si el servicio de WhatsApp se cae o el teléfono pierde internet?"
> **Respuesta:** Se diseñó bajo el patrón de **resiliencia desacoplada**. El servicio de WhatsApp corre en un proceso independiente (`whatsapp-service/`). Si el servicio de WhatsApp no está disponible o el teléfono se desconecta, la API principal del sistema sigue funcionando con total normalidad: registra la asamblea o minga, notifica al administrador en pantalla y permite continuar las operaciones sin bloquear el flujo principal.

### P5: "¿Cuál es el nivel de pruebas y calidad del software?"
> **Respuesta:** El proyecto cuenta con una cobertura integral automatizada:
> - **109 pruebas de integración en el Backend** ejecutadas contra un contenedor real de MySQL (no mocks), verificando esquemas, restricciones, RBAC, prevención de inyección SQL y reglas de negocio.
> - **122 pruebas unitarias en el Frontend** usando Vitest y Angular Testing Utilities, validando signals, guards, interceptores y componentes.
> - **25 pruebas del microservicio de WhatsApp** con navegador simulado.
> - Pipeline de Integración Continua en **GitHub Actions** (`ci.yml`) que valida linter, tests y compilación en cada pull request.

---

## 6. Checklist de Última Hora antes de Comenzar
- [ ] Docker Desktop iniciado y contenedor `junta_las_jones_mysql` activo (`docker ps`).
- [ ] Base de datos sembrada (`npm --prefix backend run db:seed` o ejecutado previamente).
- [ ] Terminal ejecutando `presentar.bat` o `npm run dev`.
- [ ] Navegador con dos ventanas o perfiles listos:
  - Ventana 1 (Admin): Carlos Moreta (`1823661267`).
  - Ventana 2 / Incógnito (Comunero): Beatriz Viteri (`1809198243`).
- [ ] Swagger abierto en otra pestaña por si el jurado solicita ver los contratos de la API (`http://localhost:3000/api-docs`).
