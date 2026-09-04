# Sistema Informático Integrado de Gestión - Junta de Agua y Riego "La Jones"

Sistema web integral desarrollado para la administración eficiente, gestión financiera, georreferenciación de lotes y portal de comunicaciones de la **Junta de Agua y Riego "La Jones"** (Patate, Tungurahua, Ecuador).

---

## 🚀 Tecnologías Utilizadas

- **Frontend:** Angular 17+, TypeScript, SCSS, RxJS, Leaflet (Mapas interactivas).
- **Backend:** Node.js, Express, JWT, CORS, Dotenv.
- **Base de Datos:** MySQL (Relacional, InnoDB, Utf8mb4).

---

## 📦 Módulos del Sistema

### 1. 📋 Gestión Administrativa
- **Nómina de Usuarios:** Registro detallado de comuneros/usuarios.
- **Control de Asistencia:** Asistencia digital a Asambleas Generales y Mingas con generación automática de multas por inasistencia.
- **Lotes por Usuario:** Dimensiones, sectores, coordenadas (Latitud/Longitud) y mapas satelitales interactivos.
- **Turnos de Riego:** Calendario semanal y horarios de distribución del agua por sector.

### 2. 💰 Gestión Financiera
- **Ingresos:** Recaudación por pagos de agua, cuotas y multas por año y concepto.
- **Cuentas por Cobrar (CxC):** Control de valores pendientes por usuario, año y concepto.
- **Egresos & Cuentas por Pagar (CxP):** Registro de compras, trabajos, honorarios y tasas pagadas.
- **Contabilidad & Balance Al Día:** Plan de cuentas, caja/bancos y balance general emitido en tiempo real.
- **Facturación, Inventarios & Activos Fijos:** Control físico y contable.
- **Integración SRI:** Generación de anexos y reportes para declaraciones del IVA.

### 3. 📢 Gestión de Comunicaciones & Portal Web
- **Página Web Pública:** Sitio informativo para comuneros y público general.
- **Convocatorias:** Publicación digital de avisos para Asambleas y Mingas.
- **Repositorio Digital:** Archivo de Actas de la Asamblea General, Directiva, resoluciones e informes de cumplimiento.

---

## 🛠️ Estructura del Proyecto

```text
JuntaAguas-LasJones-Patate/
├── backend/                  # API REST (Node.js + Express)
│   ├── database/             # Scripts SQL (schema.sql)
│   ├── src/
│   │   ├── config/           # Conexión MySQL y variables globales
│   │   ├── controllers/      # Controladores de negocio
│   │   ├── routes/           # Endpoints de la API
│   │   └── index.js          # Punto de entrada del servidor
│   ├── .env.example
│   └── package.json
├── frontend/                 # Aplicación Cliente (Angular)
│   ├── src/
│   │   ├── app/              # Componentes, servicios y rutas de Angular
│   │   └── styles.scss       # Estilos globales
│   └── angular.json
├── .gitignore
└── README.md
```

---

## ⚡ Instalación y Configuración Local

### Prerrequisitos
- **Node.js:** v18.x o superior
- **MySQL Server:** v8.0 o superior (o MariaDB equivalent)
- **Angular CLI:** `npm install -g @angular/cli`

---

### 1. Base de Datos
1. Abre tu gestor de base de datos MySQL (phpMyAdmin, MySQL Workbench, DBeaver, etc.).
2. Ejecuta el script SQL ubicado en [`backend/database/schema.sql`](backend/database/schema.sql) para crear la base de datos `junta_las_jones` y todas sus tablas.

---

### 2. Configurar y Ejecutar Backend
```bash
# Navegar al directorio del backend
cd backend

# Copiar el archivo de entorno y configurar credenciales de MySQL
cp .env.example .env

# Iniciar servidor en modo desarrollo
npm run dev
```
El servidor backend se ejecutará en: `http://localhost:3000`

---

### 3. Configurar y Ejecutar Frontend
```bash
# Navegar al directorio del frontend
cd frontend

# Ejecutar el servidor de desarrollo de Angular
ng serve --open
```
La aplicación cliente estará disponible en: `http://localhost:4200`

---

## 📄 Licencia
Este proyecto es desarrollado exclusivamente para la **Junta de Agua y Riego "La Jones" - Patate**.