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

El contenedor solo escucha en `127.0.0.1`: no queda expuesto a la red local. Las credenciales y el
puerto se configuran en `bd/.env` (copie `bd/.env.example`); si los cambia, use los mismos valores en
`backend/.env`. Los valores por defecto son solo para desarrollo.

- **Host:** `127.0.0.1` / `localhost`
- **Puerto:** `3306` (o el valor de `MYSQL_PUERTO`, por ejemplo `3310` si ya tiene otro MySQL en el 3306)
- **Base de Datos:** `junta_las_jones`
- **Usuario Root:** `root`
- **Contraseña Root:** `rootpassword`
- **Usuario Normal:** `junta_user`
- **Contraseña Usuario:** `junta_password`
