# Operación en producción

Esta guía cubre lo que hay que hacer **después** de `npm run prod`: respaldos, HTTPS, monitoreo y los riesgos conocidos de las dependencias. El despliegue inicial está en [`INSTRUCCIONES.md`](../INSTRUCCIONES.md).

## 1. Respaldos

La base guarda pagos, multas y auditoría; los documentos subidos (convocatorias, actas, comprobantes) viven en `backend/uploads/`. Ambos se respaldan con un solo comando desde la raíz del proyecto:

```bash
npm run respaldo                    # crea backups/junta-AAAAMMDD-HHMMSS.sql.gz y .uploads.tar.gz
npm run respaldo -- --mantener 30   # conserva los 30 más recientes (por defecto 14)
```

Requisitos: `mysqldump` y `tar` en el PATH. Si MySQL corre en Docker, defina `RESPALDO_DOCKER_CONTENEDOR` (por ejemplo `junta_las_jones_mysql`) y el script usará los binarios del contenedor. Los archivos se crean con permisos `600` y `backups/` no se versiona.

### Programarlo cada noche

**Linux (cron)**, `crontab -e`:

```cron
30 2 * * * cd /ruta/al/proyecto && /usr/bin/npm run respaldo >> backups/respaldo.log 2>&1
```

**Windows (Programador de tareas)**, desde PowerShell como administrador:

```powershell
schtasks /Create /SC DAILY /ST 02:30 /TN "Respaldo Junta La Jones" /TR "cmd /c cd /d C:\ruta\al\proyecto && npm run respaldo >> backups\respaldo.log 2>&1"
```

### Copia fuera del servidor

Un respaldo en el mismo equipo no protege de un disco dañado, un robo o un incendio. Copie `backups/` cada día a otro disco, otro equipo o un almacenamiento en la nube (`rclone`, `rsync` o una unidad USB rotativa). Sin copia externa, no hay respaldo.

### Restaurar

Restaurar **reemplaza** los datos actuales de la base. Detenga el servidor antes.

```bash
npm run respaldo -- --restaurar backups/junta-20261026-023000.sql.gz --confirmar
# Documentos subidos (opcional): desde la carpeta padre de backend/uploads
tar -xzf backups/junta-20261026-023000.uploads.tar.gz -C backend
```

`--confirmar` es obligatorio cuando `NODE_ENV=production`. La base debe existir (`npm run prod -- --preparar` la crea).

### Probar los respaldos

Un respaldo que nunca se restauró no está comprobado. Una vez al mes restaure el último en una base de prueba (`DB_NAME=junta_prueba npm run respaldo -- --restaurar <archivo>`, creando antes la base vacía) y compruebe que los conteos de `personas` y `pagos` coinciden.

## 2. HTTPS

Sin HTTPS, la contraseña, el token de sesión y las cédulas viajan en claro por la red. El backend no termina TLS: se pone un proxy inverso delante que obtiene el certificado y le reenvía el tráfico por `127.0.0.1`.

1. Consiga un dominio (por ejemplo `agua.ejemplo.ec`) que apunte a la IP pública del servidor y abra los puertos 80 y 443.
2. Instale **Caddy** (recomendado: renueva el certificado solo) y copie [`deploy/Caddyfile.example`](../deploy/Caddyfile.example) como `/etc/caddy/Caddyfile` cambiando el dominio. Con **Nginx** use [`deploy/nginx.conf.example`](../deploy/nginx.conf.example) y `certbot`.
3. En `backend/.env` configure:

   ```env
   HOST=127.0.0.1                    # el puerto 3000 deja de ser accesible desde la red
   TRUST_PROXY=1                     # el backend lee la IP real del cliente (auditoría y límite de intentos)
   FRONTEND_URL=https://agua.ejemplo.ec
   ```

4. Reinicie el backend y verifique:

   ```bash
   curl -I https://agua.ejemplo.ec/api/health      # 200 y Strict-Transport-Security
   curl -m 3 http://IP_DEL_SERVIDOR:3000/api/health  # debe fallar: el puerto ya no es público
   ```

5. Cierre en el firewall todo salvo 80 y 443 (y SSH). MySQL (3306) y el servicio de WhatsApp (3100) nunca deben ser accesibles desde fuera.

## 3. Registro y monitoreo

### Registro de eventos

En producción el backend escribe **una línea JSON por evento** en la salida estándar (los errores, en la de error):

```json
{"hora":"2026-10-26T14:03:11.402Z","nivel":"info","mensaje":"petición","reqId":"9b1c…","metodo":"POST","ruta":"/api/pagos","estado":201,"duracionMs":48.2,"ip":"190.x.x.x","cuentaId":3}
```

- Cada petición lleva un `X-Request-Id` (también en la respuesta). Los errores 500 devuelven `requestId` en el cuerpo: si un usuario reporta un fallo, busque ese identificador.
- No se registran contraseñas, tokens, cuerpos ni parámetros de la URL (una búsqueda por cédula, por ejemplo, no queda en el registro).
- `LOG_LEVEL` en `backend/.env` ajusta el detalle (`debug` incluye las consultas de salud).
- Con systemd: `journalctl -u junta-backend -f -o cat | jq 'select(.nivel!="info")'`. Un servicio de ejemplo con reinicio automático está en [`deploy/junta-backend.service.example`](../deploy/junta-backend.service.example).
- La auditoría de negocio (quién cobró, anuló o cambió algo) sigue en la tabla `auditoria` y en `/admin/gestion`.

### Aviso cuando el sistema se cae

`npm run vigilar` consulta `/api/health` (que también prueba la conexión a la base) cada 60 s y envía un aviso a un webhook cuando el sistema deja de responder y cuando se recupera. También avisa si el último respaldo de `backups/` tiene más de 26 horas, así un respaldo que dejó de ejecutarse no pasa inadvertido.

```bash
VIGILAR_WEBHOOK=https://hooks.slack.com/services/XXX npm run vigilar
```

El webhook recibe `{ "text": "...", "content": "..." }`, compatible con Slack, Discord y Mattermost. Variables opcionales: `VIGILAR_URL`, `VIGILAR_INTERVALO`, `VIGILAR_FALLOS` (3 fallos seguidos antes de avisar), `VIGILAR_RESPALDO_HORAS`. Con `--una-vez` hace una sola comprobación y sale con código 1 si falla, para usarlo desde cron.

Conviene además un monitor **externo** (por ejemplo UptimeRobot, gratuito) que consulte `https://su-dominio/api/health`: el vigilante corre en el mismo equipo y no puede avisar si el equipo entero se apaga.

## 4. Dependencias con avisos conocidos

`npm audit --omit=dev` en `whatsapp-service/` informa avisos que **no se pueden corregir** sin bajar `whatsapp-web.js` a una versión anterior y peor:

| Paquete | Aviso | Por qué no afecta aquí |
|---|---|---|
| `extract-zip` (vía `puppeteer`) | Escritura de archivos por enlaces simbólicos en un `.zip` | Solo se ejecuta si puppeteer **descarga** Chromium. El servicio usa el Edge o Chrome instalado (`CHROME_BIN`). Instale con `PUPPETEER_SKIP_DOWNLOAD=true npm ci`. |
| `zod` 3.x (vía `chromium-bidi`) | Consumo de memoria con colecciones enormes | Solo valida mensajes del protocolo del navegador local, nunca datos de la red. |

El servicio de WhatsApp escucha solo en `127.0.0.1` y exige token. Revise estos avisos de nuevo al actualizar `whatsapp-web.js`.
