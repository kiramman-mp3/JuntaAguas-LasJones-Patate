# Guía de Instalación y Despliegue: Junta de Aguas Las Jones

Esta guía contiene los pasos detallados para levantar el entorno de desarrollo (Base de Datos, Backend, Frontend) y la configuración inicial del sistema.

---

## 1. Requisitos Previos
- **Docker y Docker Compose** (Para levantar la base de datos).
- **Node.js 24.15 o superior** (o 22.22.3 o superior). Es obligatorio: Angular 22 no arranca con versiones anteriores. Revisa tu versión con `node -v`; en Windows puedes actualizar con `winget upgrade OpenJS.NodeJS.LTS` (luego cierra y vuelve a abrir la terminal o VS Code).
- **NPM** (Viene integrado con Node.js).
- **Angular CLI** instalado globalmente (Opcional, pero recomendado: `npm install -g @angular/cli`).

---

## 2. Levantar la Base de Datos (MySQL)

El proyecto incluye un contenedor de Docker preconfigurado que cargará automáticamente el esquema (tablas) cuando se levante por primera vez.

1. Abre una terminal y navega a la carpeta `bd`.
2. Ejecuta el siguiente comando para levantar el contenedor en segundo plano:
   ```bash
   cd bd
   docker-compose up -d
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
4. Levanta el servidor en modo desarrollo:
   ```bash
   npm run dev
   ```
5. El servidor estará escuchando en `http://localhost:3000`.

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
   npx ng serve --open
   ```
4. Esto abrirá automáticamente el navegador en `http://localhost:4200`.

**URL del backend:** el frontend toma la dirección de la API desde `frontend/src/environments/environment.ts` (desarrollo) y `environment.prod.ts` (producción). En código nuevo usa `environment.apiUrl` (o `environment.serverUrl` para abrir archivos subidos) en lugar de escribir `http://localhost:3000`.

**Problemas comunes:**
- `The Angular CLI requires a minimum Node.js version...` → actualiza Node (ver sección 1).
- `must have required property 'outputPath'` → tienes instalado Angular 18 de una versión anterior del proyecto. Borra la carpeta `node_modules` y vuelve a ejecutar `npm ci`.

---

## 6. Credenciales de Acceso

Al terminar, `npm run db:seed` imprime las credenciales: la cédula del **administrador** (Carlos Eduardo Moreta Salazar, presidente), la de un **comunero de demostración** y la contraseña común de todas las cuentas sembradas.

- La contraseña es aleatoria en cada ejecución. Para fijarla, define `SEED_PASSWORD` (mínimo 8 caracteres, con letras y números) antes de ejecutar el seed, por ejemplo `SEED_PASSWORD=Junta2026 npm run db:seed -- --reset`.
- El administrador y el comunero de demostración entran directamente. El resto de comuneros con cuenta debe cambiar la contraseña en su primer inicio de sesión, igual que una cuenta creada desde el sistema.

---

## 7. Notas Adicionales
- Si en algún momento necesitas resetear completamente la base de datos, puedes bajar el contenedor y borrar su volumen:
  ```bash
  cd bd
  docker-compose down -v
  docker-compose up -d
  ```
  Luego recuerda volver a ejecutar `npm run db:seed` en `backend`.
- Asegúrate de tener los puertos `3000` (Backend), `4200` (Frontend) y `3306` (MySQL) libres antes de levantar los servicios.
