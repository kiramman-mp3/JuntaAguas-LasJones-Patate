# Guía de Instalación y Despliegue: Junta de Aguas Las Jones

Esta guía contiene los pasos detallados para levantar el entorno de desarrollo (Base de Datos, Backend, Frontend) y la configuración inicial del sistema.

---

## 1. Requisitos Previos
- **Docker y Docker Compose** (Para levantar la base de datos).
- **Node.js 26** (el que usa el CI; como mínimo 22.22.3, que exige Angular 22). Revisa tu versión con `node -v`; en Windows puedes actualizar con `winget upgrade OpenJS.NodeJS.LTS` (luego cierra y vuelve a abrir la terminal o VS Code).
- **NPM** (Viene integrado con Node.js).
- **Angular CLI** instalado globalmente (Opcional, pero recomendado: `npm install -g @angular/cli`).

---

## 2. Levantar la Base de Datos (MySQL)

El proyecto incluye un contenedor de Docker con MySQL 8. Las tablas no las crea Docker: las crean las migraciones del backend (paso 3).

1. Abre una terminal y navega a la carpeta `bd`.
2. Ejecuta el siguiente comando para levantar el contenedor en segundo plano:
   ```bash
   cd bd
   docker compose up -d
   ```
3. Esto levantará una instancia de MySQL 8.0 en el puerto `3306`.
   - **Usuario:** `junta_user` (o `root`)
   - **Contraseña:** `junta_password` (o `rootpassword` para root)
   - **Base de datos:** `junta_las_jones`

---

## 3. Instalar y Levantar el Backend (API Node.js)

1. Abre una nueva terminal y navega a la carpeta `backend`.
2. Instala las dependencias del proyecto:
   ```bash
   cd backend
   npm install
   ```
3. Crea el archivo `.env` a partir de la plantilla (el `.env` no se sube al repositorio, cada uno debe crearlo). Ya viene configurado para la base de datos local de Docker (`DB_HOST=127.0.0.1`, `DB_USER=root`, `DB_PASSWORD=rootpassword`, `DB_NAME=junta_las_jones`, etc.):
   ```bash
   cp .env.example .env
   ```
   En PowerShell: `Copy-Item .env.example .env`
4. Genera un `JWT_SECRET` y pégalo en `.env` (el backend no arranca sin él):
   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
   ```
5. Crea la base y aplica las migraciones (es seguro repetirlo: solo aplica las pendientes y no borra datos):
   ```bash
   npm run db:migrate
   ```
6. Levanta el servidor en modo desarrollo:
   ```bash
   npm run dev
   ```
7. El servidor estará escuchando en `http://localhost:3000` y la documentación Swagger en `http://localhost:3000/api-docs`.

---

## 4. Ejecutar el Seed (Datos de Prueba)

El seed simula unos dos años de operación de la Junta con las mismas reglas de negocio que usa la API: ~120 comuneros con cédulas ecuatorianas válidas, 4 sectores, lotes y turnos de riego sin solapes, historial de tarifas, facturación mensual de agua, asambleas y mingas con asistencia y multas, pagos (algunos anulados), egresos, inventario y plan anual. Desde la carpeta `backend`:

```bash
npm run db:seed              # siembra una base vacía (aplica las migraciones pendientes)
npm run db:seed -- --reset   # elimina y recrea la base antes de sembrar
```

- Se niega a ejecutarse en producción o sobre una base que ya tiene comuneros.
- Las fechas se calculan a partir del día actual: los eventos pasados quedan realizados y hay próximos eventos convocados.

---

## 5. Instalar y Levantar el Frontend (Angular)

1. Abre una nueva terminal y navega a la carpeta `frontend`.
2. Instala las dependencias de Angular (`npm ci` instala exactamente las versiones del `package-lock.json`):
   ```bash
   cd frontend
   npm ci
   ```
3. Levanta el servidor de desarrollo de Angular:
   ```bash
   npm start
   ```
4. Abre el navegador en `http://localhost:4200`. El panel de administración está en `/admin` y cada sección tiene su URL (por ejemplo `/admin/finanzas/facturacion`).

**URL del backend:** el frontend toma la dirección de la API desde `frontend/src/environments/environment.ts` (desarrollo) y `environment.prod.ts` (producción). En código nuevo usa `environment.apiUrl` (o `environment.serverUrl` para abrir archivos subidos) en lugar de escribir `http://localhost:3000`.

**Problemas comunes:**
- `The Angular CLI requires a minimum Node.js version...` → actualiza Node (ver sección 1).
- `must have required property 'outputPath'` → tienes instalado Angular 18 de una versión anterior del proyecto. Borra la carpeta `node_modules` y vuelve a ejecutar `npm ci`.

### 5.1. Servicio de WhatsApp (opcional)

Las convocatorias se publican en un grupo de WhatsApp desde un servicio aparte (`whatsapp-service/`). Sin él, todo lo demás funciona.

1. Genera un token y ponlo **igual** en `backend/.env` y en `whatsapp-service/.env` (`WHATSAPP_SERVICE_TOKEN`):
   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
   ```
2. Instala y levanta el servicio en otra terminal (reinicia también el backend para que lea el token):
   ```bash
   cd whatsapp-service
   npm ci
   cp .env.example .env   # y pega el token
   npm run dev            # escucha en http://127.0.0.1:3100
   ```
3. En el panel, menú **WhatsApp**: *Conectar WhatsApp*, escanea el QR con el teléfono de la Junta (*Dispositivos vinculados*) y elige el grupo de las convocatorias. Para pruebas, usa un grupo propio, no el de los comuneros.

En Windows el servicio usa Microsoft Edge. Si prefieres otro navegador, indica su ruta en `CHROME_BIN`.

---

## 6. Credenciales de Acceso

Al terminar, `npm run db:seed` imprime las credenciales: la cédula del **administrador** (Carlos Eduardo Moreta Salazar, presidente), la de un **comunero de demostración** y la contraseña común de todas las cuentas sembradas.

- La contraseña es aleatoria en cada ejecución. Para fijarla, define `SEED_PASSWORD` (mínimo 8 caracteres, con letras y números) antes de ejecutar el seed, por ejemplo `SEED_PASSWORD=Junta2026 npm run db:seed -- --reset`.
- El administrador y el comunero de demostración entran directamente. El resto de comuneros con cuenta debe cambiar la contraseña en su primer inicio de sesión, igual que una cuenta creada desde el sistema.

---

## 7. Verificar antes de integrar

Lo mismo que ejecuta el CI (`.github/workflows/ci.yml`) en cada pull request a `develop` o `main`:

```bash
cd backend          && npm run lint && npm test          # necesita el contenedor de MySQL levantado
cd whatsapp-service && npm run lint && npm test          # no necesita WhatsApp ni navegador
cd frontend         && npm run lint && npm test -- --watch=false && npm run build
```

Las pruebas del backend usan su propia base (`junta_las_jones_test`), que crean y borran; no tocan `junta_las_jones`.

---

## 8. Actualizar la base de datos tras un `git pull`

Si un cambio trae migraciones nuevas (`backend/database/migrations/`), basta con:

```bash
cd backend
npm run db:migrate
```

No hace falta borrar el contenedor ni perder datos. Para crear una migración nueva, agrega el siguiente archivo numerado en esa carpeta (`013_descripcion.js` o `.sql`); nunca modifiques una migración ya publicada.

---

## 9. Notas Adicionales
- Si en algún momento necesitas resetear completamente la base de datos, puedes bajar el contenedor y borrar su volumen:
  ```bash
  cd bd
  docker compose down -v
  docker compose up -d
  ```
  Luego vuelve a ejecutar `npm run db:migrate` (y, si quieres datos de prueba, `npm run db:seed`) en `backend`.
- Asegúrate de tener los puertos `3000` (Backend), `4200` (Frontend), `3100` (servicio de WhatsApp) y `3306` (MySQL) libres antes de levantar los servicios.
