# 🗄️ Base de Datos Docker - Junta de Agua y Riego "La Jones"

Este directorio contiene la configuración de Docker Compose para desplegar el servidor MySQL 8.0 del sistema.

## 🚀 Cómo iniciar la Base de Datos

Para levantar el contenedor e inicializar las tablas automáticamente a partir de `backend/database/schema.sql`:

```bash
cd bd
docker compose up -d
```

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
