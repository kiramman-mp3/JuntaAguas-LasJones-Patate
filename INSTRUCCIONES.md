# Guía de Instalación y Despliegue: Junta de Aguas Las Jones

Esta guía contiene los pasos detallados para levantar el entorno de desarrollo (Base de Datos, Backend, Frontend) y la configuración inicial del sistema.

---

## 1. Requisitos Previos
- **Docker y Docker Compose** (Para levantar la base de datos).
- **Node.js** (Versión 18 o superior recomendada, testeado en Node 24).
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
3. El archivo `.env` ya debe estar configurado por defecto para apuntar a la base de datos local de Docker (`DB_HOST=localhost`, `DB_USER=root`, `DB_PASSWORD=rootpassword`, `DB_NAME=junta_las_jones`, etc.).
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

---

## 5. Instalar y Levantar el Frontend (Angular)

1. Abre una nueva terminal y navega a la carpeta `frontend`.
2. Instala las dependencias de Angular:
   ```bash
   cd frontend
   npm install
   ```
3. Levanta el servidor de desarrollo de Angular:
   ```bash
   npx ng serve --open
   ```
4. Esto abrirá automáticamente el navegador en `http://localhost:4200`.

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
