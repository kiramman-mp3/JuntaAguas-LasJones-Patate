# Sistema de Gestión - Junta de Agua y Riego "La Jones"

Sistema web para administrar la **Junta de Agua y Riego "La Jones"** (Patate, Tungurahua, Ecuador): comuneros y lotes, turnos de riego, asambleas y mingas con asistencia y multas, cobros, facturación mensual del agua, egresos y un portal donde cada comunero consulta su cuenta.

La guía paso a paso para levantar el entorno está en [`INSTRUCCIONES.md`](INSTRUCCIONES.md).

---

## Tecnologías

- **Frontend:** Angular 22 (componentes standalone, signals, rutas con carga diferida), TypeScript estricto, SCSS, RxJS, Leaflet, pdfmake y jsPDF (cargados bajo demanda), Vitest.
- **Backend:** Node.js 26, Express 5, mysql2 (SQL parametrizado), zod para validar la entrada, JWT, bcryptjs, helmet, multer, pdfkit y Swagger (solo fuera de producción).
- **Servicio de WhatsApp** (`whatsapp-service/`): proceso aparte con Express 5 y whatsapp-web.js (Edge o Chromium sin interfaz). Publica las convocatorias en el grupo de WhatsApp de la Junta; si se detiene, el resto del sistema sigue funcionando.
- **Base de datos:** MySQL 8 (InnoDB, utf8mb4) en Docker, con migraciones versionadas.
- **Calidad:** ESLint en backend, servicio de WhatsApp y frontend; pruebas de integración contra MySQL real; GitHub Actions (`.github/workflows/ci.yml`).

---

## Módulos

### Administración (rol ADMIN, en `/admin`)
Cada sección tiene su propia URL y se carga bajo demanda.

| Ruta | Qué hace |
|---|---|
| `/admin/dashboard` | Indicadores reales: recaudado, cartera pendiente y vencida, morosos, egresos, saldo de caja, porcentaje de cobro, asistencia y próximos eventos. |
| `/admin/comuneros` | Comuneros, cuentas de acceso con contraseña temporal, lotes georreferenciados (mapa) y transferencia de titularidad con auditoría. |
| `/admin/asistencias` | Asambleas y mingas: convocatoria, padrón de asistencia, finalización con multas automáticas por ausencia, actas por punto, documentos firmados, hoja de asistencia en PDF y convocatoria publicada en el grupo de WhatsApp de la Junta. |
| `/admin/turnos` | Turnos de riego semanales sin cruces de horario; un turno adicional genera su cobro. |
| `/admin/finanzas/cobrar` | Cobro en caja: búsqueda del comunero, obligaciones pendientes (cuotas, multas y otros rubros), efectivo o transferencia, comprobante en PDF. |
| `/admin/finanzas/pagos` | Historial de pagos por fechas, reimpresión del comprobante y anulación con motivo. |
| `/admin/finanzas/egresos` | Registro y consulta de egresos (proveedor, RUC, factura). |
| `/admin/finanzas/facturacion` | Facturación mensual del agua: estado del año mes a mes, vista previa y emisión de las cuotas. |
| `/admin/finanzas/tarifas` | Tarifas por concepto con su historial de vigencias. |

### Comunero (rol USUARIO)
- **Mi cuenta** (`/mi-cuenta`): valores pendientes, historial de pagos y lote del comunero. El servidor solo devuelve los datos de quien inició sesión.

### Portal público
- **Inicio** y **Eventos** (`/eventos`): próximas asambleas y mingas, y convocatorias firmadas. No expone datos personales.

### Solo API (sin pantalla todavía)
- Inventario de bienes (`/api/inventario`), plan anual con actividades (`/api/planes`) y auditoría (`/api/auditoria`).

> No forman parte del sistema: contabilidad (plan de cuentas), cuentas por pagar, facturación electrónica ni integración con el SRI.

---

## Arquitectura

```text
JuntaAguas-LasJones-Patate/
├── .github/workflows/ci.yml   # Lint, pruebas y build en cada PR a develop o main
├── bd/docker-compose.yml      # MySQL 8 para desarrollo
├── backend/
│   ├── database/migrations/   # Migraciones versionadas (001_baseline.sql, 002…012 .js)
│   ├── src/
│   │   ├── app.js             # App Express (sin listen; la usan las pruebas)
│   │   ├── index.js           # Arranque del servidor
│   │   ├── config/            # Variables de entorno validadas, pool MySQL (UTC), Swagger
│   │   ├── db/                # CLI: migrate, drop y seed (datos de prueba realistas)
│   │   ├── middlewares/       # Autenticación y roles, validación, manejo de errores
│   │   ├── routes/            # Endpoints y documentación OpenAPI
│   │   ├── controllers/       # Capa HTTP delgada: valida, llama al servicio, audita y responde
│   │   ├── schemas/           # Esquemas zod de eventos y finanzas
│   │   ├── services/          # Reglas de negocio y consultas (eventos, finanzas, turnos, documentos, PDF, convocatorias, auditoría)
│   │   │                      # whatsappClient.js: cliente HTTP del servicio de WhatsApp
│   │   └── shared/            # Errores HTTP, transacciones, fechas de Ecuador, roles, esquemas comunes
│   └── test/{unit,integration}/
├── whatsapp-service/          # WhatsApp Web en un proceso aparte (solo lo llama el backend, con token)
│   ├── src/                   # config, sesion (conexión, QR, grupos, envío), cliente (navegador), app (API interna)
│   └── test/                  # Pruebas con un cliente de WhatsApp simulado
└── frontend/src/app/
    ├── core/                  # auth (sesión), guard, interceptor del token, modelos tipados, servicios de API, utilidades
    ├── shared/                # Toasts, diálogos, contraseña temporal, pipe fechaLocal
    ├── pages/                 # inicio, eventos, login, mi-cuenta, no-encontrado
    │   └── admin/             # Contenedor del panel + admin.routes.ts (rutas hijas)
    │       ├── dashboard/
    │       └── components/    # comuneros, asistencias (asambleas y mingas), turnos, finanzas/{cobro-caja, historial-pagos, egresos, facturacion-mensual, tarifas}
    └── testing/               # Utilidades para las pruebas
```

**Principios:**
- Las reglas de negocio viven en `backend/src/services` y reciben una conexión dentro de una transacción (`shared/transaction.js`). Los controladores no contienen SQL de escritura.
- Toda entrada se valida con zod; un error de validación responde 400 con el mensaje del campo.
- Autorización por ruta: `soloAdmin` para la gestión; un comunero solo ve sus propios datos.
- Fechas: la Junta opera en hora de Ecuador (UTC-5). Las fechas de calendario viajan como `AAAA-MM-DD`; los instantes (por ejemplo, la fecha de un pago) se guardan en UTC y se filtran por día de Ecuador.
- El frontend usa un único interceptor para el token y clientes de API tipados (`AdminService`, `FinanzasService`, `ConsultaService`).

---

## Inicio rápido

Requisitos: **Node.js 26** (Angular 22 exige al menos 22.22), **Docker** y **npm**.

```bash
# 1. Base de datos
cd bd && docker compose up -d

# 2. Backend
cd ../backend
npm ci
cp .env.example .env          # y completa JWT_SECRET (ver el comentario del archivo)
npm run db:migrate            # crea la base y aplica las migraciones
npm run db:seed -- --reset    # opcional: datos de prueba (borra y recrea la base)
npm run dev                   # http://localhost:3000  ·  Swagger: http://localhost:3000/api-docs

# 3. Frontend (otra terminal)
cd frontend
npm ci
npm start                     # http://localhost:4200

# 4. Servicio de WhatsApp (opcional, otra terminal)
cd whatsapp-service
npm ci
cp .env.example .env          # mismo WHATSAPP_SERVICE_TOKEN que en backend/.env
npm run dev                   # http://127.0.0.1:3100 (solo para el backend)
```

El seed imprime al terminar la cédula del administrador, la de un comunero de demostración y la contraseña.

---

## Despliegue en producción

Un solo comando prepara y arranca todo con una **base de datos limpia**: el backend sirve la API y el frontend compilado desde el mismo origen (sin CORS ni dominio que configurar).

```bash
cp backend/.env.production.example backend/.env   # complete DB_*, JWT_SECRET, ADMIN_* y WHATSAPP_SERVICE_TOKEN
cp whatsapp-service/.env.example whatsapp-service/.env   # opcional: el mismo WHATSAPP_SERVICE_TOKEN
npm run prod                                     # desde la raíz del proyecto
```

`npm run prod` hace, en orden:

1. Verifica Node.js (22.22.3+, 24.15+ o 26+) y que `backend/.env` sea apto para producción: `NODE_ENV=production`, sin contraseñas de ejemplo y con un `JWT_SECRET` válido. Si existe `whatsapp-service/.env`, comprueba que su token coincida con el del backend.
2. Instala las dependencias si faltan (`npm run prod -- --instalar` fuerza `npm ci`).
3. Compila el frontend en modo producción.
4. Prepara la base (`npm --prefix backend run db:setup`): la crea si no existe, aplica las migraciones (catálogos de roles y conceptos de cobro) y, si no hay ningún administrador, crea el primero con `ADMIN_CEDULA`, `ADMIN_NOMBRES` y `ADMIN_APELLIDOS`. **La contraseña temporal se muestra una sola vez**: anótela; se cambia en el primer ingreso.
5. Inicia el servidor en `http://localhost:PORT` y, si está configurado, el servicio de WhatsApp. Si este se detiene, la API sigue funcionando.

Es seguro repetirlo: nunca siembra datos de prueba ni borra información; en una base en uso solo aplica las migraciones pendientes. Con `npm run prod:preparar` se hacen los pasos 1 a 4 sin iniciar el servidor, para dejarlo en manos de pm2, systemd o un servicio de Windows (`npm start`).

Primeros pasos en el panel, con la base vacía:

- **Ajustes → Tarifas:** registre la cuota de agua y las multas por inasistencia a asamblea y a minga (sin ellas no se pueden facturar meses ni crear eventos con multa).
- **Comuneros y lotes → Catastro:** cree los sectores y luego los lotes.
- **Comuneros y lotes → Padrón:** registre a los comuneros y sus cuentas de acceso.
- **WhatsApp** (menú lateral): pulse *Conectar WhatsApp*, escanee el código QR con el teléfono de la Junta (*Dispositivos vinculados*) y elija el grupo donde se publicarán las convocatorias.

Recomendaciones del servidor: publique detrás de un proxy con HTTPS (Nginx, Caddy) y ponga `TRUST_PROXY=1`; respalde la base y la carpeta `backend/uploads` (documentos firmados). Las convocatorias por WhatsApp usan un navegador en el servidor.

### Convocatorias por WhatsApp

- Cada asamblea o minga se publica **una vez** en el grupo elegido, con fecha, hora, lugar, orden del día y multa por inasistencia, y el evento pasa a *Convocada*. Para repetirla, el sistema pide confirmación.
- No se puede convocar un evento cancelado, realizado o con fecha pasada. Cada envío (correcto o fallido) queda en `envios_convocatoria` y en la auditoría.
- La cuenta de WhatsApp de la Junta debe pertenecer al grupo y, si el grupo solo permite mensajes de administradores, ser administradora.
- **Navegador:** en Windows se usa Microsoft Edge (con un perfil nuevo, Chrome falla al cargar WhatsApp Web); en Linux, `google-chrome` o `chromium`. Con `CHROME_BIN` en `whatsapp-service/.env` se elige otro.
- La sesión vinculada se guarda en `whatsapp-service/.wwebjs_auth`. La que guardaba antes el backend (`backend/.wwebjs_auth`) ya no se usa: vuelva a escanear el QR, o apunte `WHATSAPP_AUTH_DIR` a esa carpeta.

---

## Comandos

| Dónde | Comando | Qué hace |
|---|---|---|
| backend | `npm run dev` | Servidor con recarga automática |
| backend | `npm run lint` | ESLint |
| backend | `npm test` | Pruebas unitarias y de integración (necesita MySQL; usa la base `junta_las_jones_test`, que crea y borra) |
| raíz | `npm run prod` | Despliegue de producción con base limpia (ver arriba) |
| backend | `npm run db:migrate` | Aplica las migraciones pendientes |
| backend | `npm run db:setup` | Migraciones y primer administrador (producción) |
| backend | `npm run db:seed [-- --reset]` | Datos de prueba realistas (nunca en producción) |
| whatsapp-service | `npm run dev` / `npm start` | Servicio de WhatsApp (con recarga / producción) |
| whatsapp-service | `npm run lint` · `npm test` | ESLint y pruebas (no necesitan WhatsApp ni navegador) |
| raíz | `npm run lint` · `npm test` | Lint y pruebas de backend, servicio de WhatsApp y frontend |
| frontend | `npm start` | Servidor de desarrollo |
| frontend | `npm run lint` | ESLint (angular-eslint) |
| frontend | `npm test -- --watch=false` | Pruebas con Vitest |
| frontend | `npm run build` | Build de producción en `dist/` |

---

## Flujo de trabajo

Ramas `main` (estable), `develop` (integración) y `feature/*`, `fix/*`, `refactor/*`, `chore/*`, con Conventional Commits. El detalle está en [`CLAUDE.md`](CLAUDE.md). El CI ejecuta lint, pruebas y build en cada pull request a `develop` o `main`.

---

## Licencia
Desarrollado exclusivamente para la **Junta de Agua y Riego "La Jones" - Patate**.
