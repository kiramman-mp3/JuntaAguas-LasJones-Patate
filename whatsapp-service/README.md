# 📱 Microservicio de Integración WhatsApp Web

Servicio independiente en Node.js encargado de mantener la sesión de WhatsApp de la Junta de Agua y Riego "La Jones" (Patate), exponer su estado en tiempo real y publicar las convocatorias oficiales a asambleas y mingas en el grupo comunitario.

---

## 🏗️ Arquitectura y Funcionamiento

El microservicio se ejecuta como un proceso desacoplado del backend principal para garantizar alta disponibilidad y evitar que el ciclo de vida del navegador (Chromium/Edge) interfiera con la API transaccional.

```
┌─────────────────────────┐          ┌─────────────────────────┐          ┌─────────────────────────┐
│     Panel Admin UI      │          │       Backend Core      │          │    WhatsApp Service     │
│   (Angular + Polling)   │ ───────> │    (API Transaccional)  │ ───────> │  (whatsapp-web.js +     │
│                         │   HTTP   │                         │  Bearer  │   Puppeteer / Chromium) │
└─────────────────────────┘          └─────────────────────────┘          └─────────────────────────┘
            │                                                                          │
            ▼                                                                          ▼
  ngOnDestroy():                                                              .wwebjs_auth/
  Limpia intervalos                                                           (Sesión local
  y evita fugas                                                                aislada e ignorada)
```

1. **Aislamiento de Recursos:** Utiliza `whatsapp-web.js` con Puppeteer para controlar una instancia de navegador en modo headless/new-profile.
2. **Seguridad y Token:** Todas las peticiones provenientes del backend están protegidas mediante el encabezado `Authorization: Bearer <WHATSAPP_SERVICE_TOKEN>`.
3. **Persistencia de Sesión (`.wwebjs_auth`):** La sesión activa vinculada mediante código QR se almacena en el directorio local `.wwebjs_auth/`. Dicho directorio está estrictamente excluido en `.gitignore` por contener credenciales de sesión activas.
4. **Ciclo de Vida Frontend:** Para evitar fugas de memoria (*memory leaks*), las vistas del frontend consumen el estado a través de `WhatsAppSesionService`, implementando la interfaz `OnDestroy` con su respectivo hook `ngOnDestroy` para detener inmediatamente los intervalos de sondeo al desmontar los componentes.

---

## 📡 Endpoints del Microservicio

| Método | Endpoint | Descripción |
| :--- | :--- | :--- |
| `GET` | `/api/whatsapp/status` | Retorna el estado actual de la sesión (`DESCONECTADO`, `INICIANDO`, `ESPERANDO_QR`, `CONECTADO`). |
| `POST` | `/api/whatsapp/iniciar` | Inicia el cliente de WhatsApp Web y genera el código QR si no existe sesión previa. |
| `POST` | `/api/whatsapp/logout` | Cierra la sesión activa del dispositivo y limpia credenciales locales. |
| `GET` | `/api/whatsapp/grupos` | Lista los grupos de WhatsApp donde participa la cuenta de la Junta. |
| `POST` | `/api/whatsapp/enviar-convocatoria` | Publica el mensaje formateado de la asamblea o minga en el grupo configurado. |

---

## ⚙️ Configuración (.env)

Cree el archivo `.env` en este directorio a partir de `.env.example`:

```env
PORT=3100
WHATSAPP_SERVICE_TOKEN=token_generado_coincidente_con_el_backend
WHATSAPP_AUTH_DIR=.wwebjs_auth
# Opcional en Linux/Docker si no se usa la detección automática:
# CHROME_BIN=/usr/bin/google-chrome
```

> **Nota de Seguridad:** El valor de `WHATSAPP_SERVICE_TOKEN` debe ser idéntico al configurado en `backend/.env`.
