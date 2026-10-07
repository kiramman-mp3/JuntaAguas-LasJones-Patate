# 🗄️ Base de Datos Docker - Junta de Agua y Riego "La Jones"

Este directorio contiene la configuración de Docker Compose para desplegar el servidor MySQL 8.0 del sistema.

## 🚀 Cómo iniciar la Base de Datos

```bash
cd bd
docker compose up -d
```

El contenedor crea una base vacía. Las tablas las crean las migraciones del backend:

```bash
cd backend
npm run db:migrate
```

> Si tu contenedor se creó con una versión anterior de este archivo (que montaba `backend/database/schema.sql`) y ya no arranca, recréalo con `docker compose up -d --force-recreate`. Los datos están en el volumen `mysql_data` y se conservan.

## 🛑 Cómo detener el servicio

```bash
docker compose down
```

## 🔐 Credenciales

- **Host:** `127.0.0.1` / `localhost`
- **Puerto:** `3306`
- **Base de Datos:** `junta_las_jones`
- **Usuario Root:** `root`
- **Contraseña Root:** `rootpassword`
- **Usuario Normal:** `junta_user`
- **Contraseña Usuario:** `junta_password`
