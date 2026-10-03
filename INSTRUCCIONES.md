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

## 4. Ejecutar el Seed (Datos de Prueba iniciales)

El archivo `seed.sql` contiene datos iniciales necesarios para probar el sistema: ROLES, CONCEPTOS DE PAGO, COMUNEROS y CUENTAS DE USUARIO.

Para inyectarlo en la base de datos, tienes dos opciones:

**Opción A: Desde la consola del contenedor Docker**
En la carpeta raíz del proyecto, ejecuta:
```bash
docker exec -i junta_las_jones_mysql mysql -u root -prootpassword junta_las_jones < backend/database/seed.sql
```

**Opción B: Usando un Gestor de Base de Datos (DBeaver, MySQL Workbench, etc.)**
1. Conéctate a la base de datos `localhost:3306` con el usuario `root` y contraseña `rootpassword`.
2. Abre el archivo `backend/database/seed.sql`.
3. Ejecuta todo el script SQL.

**Opción C: Datos masivos de prueba (`npm run seed-db`)**
Genera ~150 comuneros, 200 lotes, 8 eventos (5 pasados y 3 futuros), deudas y pagos. Es la opción recomendada para probar paginación, filtros e historial de eventos. Desde la carpeta `backend`:
```bash
npm run seed-db
```
*Usa credenciales distintas a las de `seed.sql` (ver sección 6).*

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

En el `seed.sql` se configuró una misma contraseña genérica (`admin123`) para todos los usuarios.

### 👤 Usuario Administrador (Acceso total)
- **Cédula:** `1800000001` (Carlos Eduardo Moreta Salazar)
- **Contraseña:** `admin123`
- *Nota: Tiene acceso al panel de administración completo (Directiva).*

### 👤 Usuario Normal (Comunero)
- **Cédula:** `1800000002` (María Rosa Quispe Toapanta)
- **Contraseña:** `admin123`
- *Nota: Tiene acceso al portal de comuneros para ver sus deudas, historial y certificados.*

### Si usaste `npm run seed-db` (Opción C)
Todas las cuentas tienen la contraseña `123456`.
- **Administrador:** cédula `1801234567`
- **Comuneros:** cédulas `1800000002` a `1800000150`

---

## 7. Notas Adicionales
- Si en algún momento necesitas resetear completamente la base de datos, puedes bajar el contenedor y borrar su volumen:
  ```bash
  cd bd
  docker-compose down -v
  docker-compose up -d
  ```
  Luego recuerda volver a ejecutar el `seed.sql`.
- Asegúrate de tener los puertos `3000` (Backend), `4200` (Frontend) y `3306` (MySQL) libres antes de levantar los servicios.
