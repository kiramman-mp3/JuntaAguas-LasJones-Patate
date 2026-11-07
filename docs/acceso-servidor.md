# Acceso al servidor por SSH

Guía para quien se incorpore al proyecto y necesite entrar al servidor de producción. Explica cómo crear una llave SSH, cómo se autoriza y cómo se cierra el acceso por contraseña. La puesta en marcha completa del servidor está en [`operacion.md`](operacion.md), sección 0.

> [!WARNING]
> Nunca escriba en el repositorio, en un chat ni en un commit: contraseñas, llaves privadas (`id_ed25519`), el contenido de `backend/.env` ni la contraseña temporal del administrador. Una contraseña pegada en un chat se considera expuesta: cámbiela de inmediato.

En los ejemplos, `IP_DEL_SERVIDOR` es la dirección del VPS (se pide a un administrador) y `junta` es el usuario sin privilegios con el que se trabaja.

---

## 1. Por qué llave y no contraseña

El puerto 22 está abierto a todo internet y los bots prueban contraseñas a todas horas. Quien entre por SSH controla el servidor, la base de datos y los datos de los socios. `fail2ban` frena los intentos, pero una contraseña débil acaba cayendo.

Una llave SSH son dos archivos: la **privada** (`id_ed25519`), que no sale de su computador, y la **pública** (`id_ed25519.pub`), que sí se comparte y se registra en el servidor. El servidor deja entrar solo a quien tiene la privada, y esa no se puede adivinar.

| Archivo | ¿Es secreto? | Qué hacer con él |
|---|---|---|
| `~/.ssh/id_ed25519` (privada) | **Sí** | No compartirla ni subirla al repositorio; guardar una copia cifrada |
| `~/.ssh/id_ed25519.pub` (pública) | No | Enviarla al administrador para que la autorice |

---

## 2. Crear su llave

Una llave por persona y por equipo. Nunca se comparte una llave entre programadores: así se puede revocar el acceso de uno sin afectar a los demás.

```bash
ssh-keygen -t ed25519 -C "su-nombre@su-equipo"
```

* Acepte la ruta por defecto (`~/.ssh/id_ed25519`; en Windows, `C:\Users\<usuario>\.ssh\id_ed25519`). Si ya existe una llave ahí, **no la sobrescriba**: use otro nombre de archivo.
* **Escriba una frase de contraseña.** Con ella, quien robe el archivo no puede usarlo. Si ya creó la llave sin frase, agréguela con `ssh-keygen -p -f ~/.ssh/id_ed25519`.

Muestre la llave pública para enviarla (es una sola línea que empieza por `ssh-ed25519`):

```bash
cat ~/.ssh/id_ed25519.pub        # Windows PowerShell: type $env:USERPROFILE\.ssh\id_ed25519.pub
```

---

## 3. Autorizar la llave en el servidor

Cada llave autorizada es una línea en `/home/junta/.ssh/authorized_keys`.

**Si usted es el administrador y aún entra con contraseña** (primera vez), copie su propia llave desde su computador:

```bash
# macOS / Linux / Git Bash
ssh-copy-id junta@IP_DEL_SERVIDOR
```

Windows no trae `ssh-copy-id`. En PowerShell use este comando (pide la contraseña una vez):

```powershell
type $env:USERPROFILE\.ssh\id_ed25519.pub | ssh junta@IP_DEL_SERVIDOR "mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
```

> [!CAUTION]
> En Windows PowerShell 5.1 el comando anterior puede guardar la línea con una marca invisible (BOM) al inicio y `\r` al final. SSH rechaza esa línea y la llave "no funciona" aunque el comando no dé error. Compruébelo en el servidor con `cat -A ~/.ssh/authorized_keys`: la línea debe empezar por `ssh-ed25519` y terminar en `$`, sin `M-oM-;M-?` al principio ni `^M` al final. Se corrige con:
>
> ```bash
> sed -i 's/^\xEF\xBB\xBF//; s/\r$//' ~/.ssh/authorized_keys
> ```

**Si usted es un programador nuevo**, envíe su llave **pública** a un administrador (por mensaje, es segura de compartir). El administrador, ya conectado, la añade:

```bash
echo "ssh-ed25519 AAAA...su-llave-publica... su-nombre@su-equipo" >> ~/.ssh/authorized_keys
```

Cada llave debe quedar en su propia línea, sin saltos en medio.

---

## 4. Comprobar que entra con la llave

```bash
ssh -o PasswordAuthentication=no junta@IP_DEL_SERVIDOR
```

Debe pedir la **frase de su llave**, no la contraseña del servidor. Si responde `Permission denied (publickey,password)`, vea la sección 7.

Para no escribir la dirección cada vez, agregue en `~/.ssh/config`:

```
Host junta
    HostName IP_DEL_SERVIDOR
    User junta
    IdentityFile ~/.ssh/id_ed25519
```

Desde entonces basta `ssh junta`.

---

## 5. Cerrar el acceso por contraseña (una sola vez, lo hace un administrador)

Solo cuando **al menos una llave ya funciona** (sección 4). Si lo hace antes, nadie puede entrar por SSH y habría que recuperar el acceso desde la consola web del proveedor.

1. Con la sesión abierta, cree un archivo de configuración. El nombre empieza por `00-` a propósito:

   ```bash
   echo -e "PasswordAuthentication no\nPermitRootLogin no" | sudo tee /etc/ssh/sshd_config.d/00-hardening.conf
   sudo sshd -t && sudo systemctl restart ssh
   ```

   SSH usa el **primer** valor que encuentra al leer `/etc/ssh/sshd_config.d/` en orden alfabético. En los servidores de Contabo, `50-cloud-init.conf` activa `PasswordAuthentication yes`; un archivo que se llame `60-...` o `99-...` llegaría tarde y no tendría efecto.

2. **Sin cerrar la sesión actual**, abra otra terminal y compruebe que sigue entrando con la llave.
3. Verifique la configuración efectiva:

   ```bash
   sudo sshd -T | grep -E "passwordauthentication|permitrootlogin"
   ```

   Ambos deben decir `no`.
4. Cierre cualquier sesión de `root` que haya quedado abierta (`last` las lista) y cambie la contraseña de `junta` con `sudo passwd junta`.

---

## 6. Respaldar la llave privada

Si formatea el computador y pierde `id_ed25519`, pierde el acceso desde esa máquina, pero no el servidor. Para no depender de eso:

* Guarde una copia en un USB aparte del computador, o en un gestor de contraseñas que admita archivos cifrados (por ejemplo, Bitwarden).
* Si la sube a una nube, que sea dentro de un archivo cifrado con una contraseña fuerte y con verificación en dos pasos en la cuenta.
* Copie solo la privada; la pública se regenera con `ssh-keygen -y -f ~/.ssh/id_ed25519`.
* Tenga al menos **dos** llaves autorizadas (por ejemplo, laptop y otro equipo) para que perder una no deje a nadie fuera.

**Si pierde todas las llaves:** el proveedor (Contabo) ofrece una consola web (VNC) que entra al servidor sin SSH. Desde ahí se autoriza una llave nueva en `authorized_keys` o se restablece la contraseña. Por eso la cuenta del proveedor debe tener contraseña fuerte y verificación en dos pasos.

### Retirar el acceso de un programador

Un administrador abre `~/.ssh/authorized_keys` en el servidor y borra la línea de esa persona (el final de la línea indica de quién es). El cambio es inmediato.

---

## 7. Problemas frecuentes

| Síntoma | Causa probable | Solución |
|---|---|---|
| `Permission denied (publickey,password)` con la llave recién copiada | La línea de `authorized_keys` tiene BOM o `\r` (Windows) | Sección 3, recuadro de advertencia |
| `Permission denied (publickey)` después de cerrar la contraseña | La llave no está autorizada o no se ofrece | `ssh -v junta@IP_DEL_SERVIDOR` y busque `Offering public key`; confirme la línea en `authorized_keys` |
| Sigue aceptando contraseña tras el paso 5 | El archivo se llama con un número mayor que `50` | Renombre a `00-hardening.conf` y reinicie `ssh` |
| `WARNING: UNPROTECTED PRIVATE KEY FILE` | Permisos demasiado abiertos en la privada | `chmod 600 ~/.ssh/id_ed25519` (en Windows, quite a otros usuarios en Propiedades → Seguridad) |
| `REMOTE HOST IDENTIFICATION HAS CHANGED` | Se reinstaló el servidor o hay un intruso en la red | Confirme con un administrador antes de borrar la línea de `~/.ssh/known_hosts` |
| Caddy no arranca tras editar su configuración | `caddy validate` se ejecutó como root y dejó un log que Caddy no puede abrir | Valide con `sudo -u caddy caddy validate --config /etc/caddy/Caddyfile` |

---

## 8. Comandos útiles una vez dentro

```bash
sudo systemctl status junta-backend          # estado del servicio
sudo journalctl -u junta-backend -f          # registro en vivo
cd /opt/junta-las-jones && git log -1        # versión desplegada
npm run vigilar                              # verificación de salud (ver operacion.md, sección 3)
```

La configuración (`backend/.env`) vive solo en el servidor, con permisos `600`, y no está en el repositorio.

---

## 9. Primeros pasos para un programador nuevo

1. Clone el repositorio y trabaje en local siguiendo [`INSTRUCCIONES.md`](../INSTRUCCIONES.md) (base de datos de pruebas, backend, frontend).
2. Lea `CLAUDE.md`: flujo de ramas (`main` ← `develop` ← `feature/*`, `fix/*`, `docs/*`…) y commits pequeños con Conventional Commits, en inglés.
3. Cree su llave SSH (sección 2) y pida a un administrador que la autorice solo si necesita entrar al servidor; para desarrollar no hace falta.
4. Lea [`operacion.md`](operacion.md) antes de tocar producción: respaldos, HTTPS, monitoreo y recuperación del administrador.
