# Sincronización de Base de Datos para el Equipo (Fix I8)

Este documento detalla qué debe hacer cada miembro del equipo para tener la base de datos alineada con el reciente cambio en el esquema (se agregó el estado `PROGRAMADO` al ENUM de la tabla `eventos`).

Existen dos escenarios posibles dependiendo de si el compañero ya tiene el proyecto levantado o si recién va a clonar el repositorio.

---

## Caso 1: Compañeros que YA TIENEN la base de datos instalada y con datos

Si un compañero ya hizo `docker-compose up` antes y tiene datos en su BD local que no quiere perder (comuneros, cuentas, lotes, etc.), **no necesita borrar su contenedor**. Simplemente debe ejecutar el script de migración que se ha creado.

### Opción A: Desde la consola de su entorno local (Windows/Mac/Linux)
Deben posicionarse en la carpeta raíz del proyecto (`JuntaAguas-LasJones-Patate`) y ejecutar el siguiente comando según su sistema:

**Si usan PowerShell (Windows):**
```powershell
Get-Content backend/database/add_programado_to_eventos_estado.sql | docker exec -i junta_las_jones_mysql mysql -uroot -prootpassword junta_las_jones
```

**Si usan Bash (Linux, Mac, Git Bash):**
```bash
docker exec -i junta_las_jones_mysql mysql -uroot -prootpassword junta_las_jones < backend/database/add_programado_to_eventos_estado.sql
```

### Opción B: Desde un gestor de Base de Datos (DBeaver, MySQL Workbench)
1. Conectarse a la BD en `localhost:3306` con credenciales:
   - User: `root`
   - Password: `rootpassword`
2. Abrir y ejecutar el contenido del archivo `backend/database/add_programado_to_eventos_estado.sql`:
   ```sql
   USE junta_las_jones;
   ALTER TABLE eventos
     MODIFY COLUMN estado ENUM('BORRADOR', 'PROGRAMADO', 'CONVOCADO', 'REALIZADO', 'CANCELADO') NOT NULL DEFAULT 'BORRADOR';
   ```

---

## Caso 2: Compañeros que NO TIENEN la base de datos levantada todavía (Instalación desde cero)

Para los compañeros que instalan el proyecto por primera vez, **no tienen que hacer nada extra**. 

¿Por qué?
El archivo principal de esquema (`backend/database/schema.sql`) **ya fue actualizado** en mi último commit. 

Cuando ellos levanten su base de datos usando el procedimiento normal del proyecto, el estado `PROGRAMADO` ya vendrá incluido.

**Procedimiento normal que seguirán (según INSTRUCCIONES.md):**
1. Levantar contenedor:
   ```bash
   cd bd
   docker-compose up -d
   ```
   *(Docker automáticamente leerá el `schema.sql` actualizado y creará la tabla `eventos` con el nuevo ENUM).*
2. (Opcional) Correr los seeds si quieren datos de prueba:
   ```bash
   cd backend
   npm run db:seed -- --reset
   ```

---

### Resumen Técnico
El fix aplicó dos cambios:
1. Se modificó `schema.sql` (Afecta solo a nuevas instalaciones — Caso 2).
2. Se creó `add_programado_to_eventos_estado.sql` (Migración para instalaciones existentes — Caso 1).

Con estas instrucciones, todo el equipo estará operando sobre la misma versión del esquema sin riesgo de pérdida de datos.
