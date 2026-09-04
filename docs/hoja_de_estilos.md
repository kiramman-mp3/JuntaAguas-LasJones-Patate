# 🎨 Guía de Estilos y Sistema de Diseño (Design System)
## Sistema Integrado de Gestión - Junta de Agua y Riego "La Jones" (Patate)

Esta **Hoja de Estilos de Referencia** establece las directrices de diseño visual, paleta de colores, tipografía, componentes e interacciones para el desarrollo de la interfaz de usuario en **Angular (SCSS / CSS)**.

---

## 🌿 1. Identidad Visual y Concepto

La identidad visual está inspirada en la naturaleza, el agua purificada de vertiente y el valle fértil de **Patate (Tungurahua)**. Utiliza tonos **Azul Océano/Cian** (Agua), **Verde Esmeralda** (Agro/Campos) y **Gris Pizarra/Oscuro** (Elegancia y modernidad).

---

## 🎨 2. Paleta de Colores y Tokens CSS

Definición de variables CSS en `src/styles.scss`:

```css
:root {
  /* --- Colores Primarios (Agua / Junta) --- */
  --color-primary: #0284c7;          /* Azul Océano Principal */
  --color-primary-hover: #0369a1;    /* Azul Oscuro Hover */
  --color-primary-light: #e0f2fe;    /* Fondo Azul Claro */
  
  /* --- Colores Secundarios (Cian / Vertiente) --- */
  --color-secondary: #06b6d4;        /* Cian Turquesa */
  --color-secondary-hover: #0891b2;  /* Cian Hover */
  
  /* --- Colores de Afectación / Agricultura --- */
  --color-agricultural: #10b981;     /* Verde Esmeralda (Mingas/Campos) */
  --color-accent-amber: #f59e0b;     /* Ámbar (Alertas/Pendientes) */
  --color-danger: #ef4444;           /* Rojo Rose (Multas/Inasistencias/Eliminar) */
  --color-success: #10b981;          /* Verde Éxito */
  
  /* --- Neutros (Modo Claro) --- */
  --bg-app: #f8fafc;                 /* Fondo General de la App */
  --bg-surface: #ffffff;             /* Fondo de Tarjetas y Contenedores */
  --bg-surface-hover: #f1f5f9;       /* Hover en Filas o Listas */
  --border-color: #e2e8f0;           /* Bordes sutiles */
  
  /* --- Tipografía --- */
  --text-main: #0f172a;              /* Texto Principal (Oscuro Profundo) */
  --text-muted: #64748b;             /* Texto Secundario / Deshabilitado */
  --text-white: #ffffff;             /* Texto sobre fondos oscuros */
  
  /* --- Sombras y Efectos Glassmorphism --- */
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  --shadow-glass: 0 8px 32px 0 rgba(31, 38, 135, 0.07);
  --glass-bg: rgba(255, 255, 255, 0.85);
  --glass-border: rgba(255, 255, 255, 0.18);
  
  /* --- Radios de Borde --- */
  --radius-sm: 0.375rem; /* 6px */
  --radius-md: 0.5rem;   /* 8px */
  --radius-lg: 0.75rem;  /* 12px */
  --radius-xl: 1rem;     /* 16px */
  --radius-full: 9999px;
}

/* --- Modo Oscuro (Opcional / Dark Theme) --- */
[data-theme="dark"] {
  --bg-app: #0f172a;
  --bg-surface: #1e293b;
  --bg-surface-hover: #334155;
  --border-color: #334155;
  --text-main: #f8fafc;
  --text-muted: #94a3b8;
  --glass-bg: rgba(30, 41, 59, 0.85);
}
```

---

## 🔤 3. Sistema Tipográfico

Utilizamos la fuente **Outfit** o **Inter** de Google Fonts para una legibilidad moderna.

```html
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
```

### Escala de Fuentes SCSS
```scss
body {
  font-family: 'Outfit', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  color: var(--text-main);
  background-color: var(--bg-app);
  font-size: 1rem; /* 16px */
  line-height: 1.5;
}

h1, .h1 { font-size: 1.875rem; font-weight: 700; line-height: 1.25; } /* 30px */
h2, .h2 { font-size: 1.5rem;   font-weight: 600; line-height: 1.3;  } /* 24px */
h3, .h3 { font-size: 1.25rem;  font-weight: 600; line-height: 1.4;  } /* 20px */
h4, .h4 { font-size: 1.125rem; font-weight: 500; line-height: 1.4;  } /* 18px */

.caption { font-size: 0.875rem; color: var(--text-muted); }           /* 14px */
.small   { font-size: 0.75rem;  color: var(--text-muted); }           /* 12px */
```

---

## 🧩 4. Componentes UI de Referencia

### 4.1. Botones (`.btn`)
```scss
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.625rem 1.25rem;
  font-size: 0.9375rem;
  font-weight: 500;
  border-radius: var(--radius-md);
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.2s ease-in-out;
  text-decoration: none;

  &:hover {
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }

  &:active {
    transform: translateY(0);
  }

  &--primary {
    background-color: var(--color-primary);
    color: var(--text-white);
    &:hover { background-color: var(--color-primary-hover); }
  }

  &--secondary {
    background-color: var(--color-secondary);
    color: var(--text-white);
    &:hover { background-color: var(--color-secondary-hover); }
  }

  &--outline {
    background-color: transparent;
    border-color: var(--border-color);
    color: var(--text-main);
    &:hover { background-color: var(--bg-surface-hover); }
  }

  &--danger {
    background-color: var(--color-danger);
    color: var(--text-white);
    &:hover { filter: brightness(0.9); }
  }

  &--sm {
    padding: 0.375rem 0.75rem;
    font-size: 0.8125rem;
  }
}
```

### 4.2. Tarjetas y Paneles (`.card` / Glassmorphism)
```scss
.card {
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 1.5rem;
  box-shadow: var(--shadow-sm);
  transition: box-shadow 0.2s ease;

  &:hover {
    box-shadow: var(--shadow-md);
  }

  &--glass {
    background: var(--glass-bg);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid var(--glass-border);
    box-shadow: var(--shadow-glass);
  }

  &__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid var(--border-color);
  }

  &__title {
    font-size: 1.25rem;
    font-weight: 600;
    margin: 0;
  }
}
```

### 4.3. Etiquetas de Estado / Badges (`.badge`)
```scss
.badge {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.625rem;
  font-size: 0.75rem;
  font-weight: 600;
  border-radius: var(--radius-full);
  text-transform: uppercase;
  letter-spacing: 0.025em;

  &--success {
    background-color: #d1fae5;
    color: #065f46;
  }

  &--warning {
    background-color: #fef3c7;
    color: #92400e;
  }

  &--danger {
    background-color: #fee2e2;
    color: #991b1b;
  }

  &--info {
    background-color: #e0f2fe;
    color: #075985;
  }
}
```

### 4.4. Tablas de Datos (`.table-custom`)
```scss
.table-container {
  width: 100%;
  overflow-x: auto;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-color);
  background-color: var(--bg-surface);
}

.table-custom {
  width: 100%;
  border-collapse: collapse;

  th {
    background-color: var(--bg-app);
    color: var(--text-muted);
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 0.875rem 1rem;
    text-align: left;
    border-bottom: 1px solid var(--border-color);
  }

  td {
    padding: 1rem;
    font-size: 0.875rem;
    color: var(--text-main);
    border-bottom: 1px solid var(--border-color);
  }

  tr:last-child td {
    border-bottom: none;
  }

  tr:hover td {
    background-color: var(--bg-surface-hover);
  }
}
```

### 4.5. Formularios e Inputs (`.form-group` / `.form-control`)
```scss
.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  margin-bottom: 1.25rem;

  label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text-main);
  }

  .form-control {
    width: 100%;
    padding: 0.625rem 0.875rem;
    font-size: 0.9375rem;
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    background-color: var(--bg-surface);
    color: var(--text-main);
    transition: border-color 0.15s ease, box-shadow 0.15s ease;

    &:focus {
      outline: none;
      border-color: var(--color-primary);
      box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.15);
    }

    &::placeholder {
      color: var(--text-muted);
    }
  }
}
```

---

## 📊 5. Tarjetas de Métricas KPI Financieras

```scss
.kpi-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  background: var(--bg-surface);
  border-radius: var(--radius-lg);
  padding: 1.25rem;
  border: 1px solid var(--border-color);

  &__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 3rem;
    height: 3rem;
    border-radius: var(--radius-md);
    background: var(--color-primary-light);
    color: var(--color-primary);

    svg {
      width: 1.5rem;
      height: 1.5rem;
    }
  }

  &__value {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--text-main);
  }

  &__label {
    font-size: 0.875rem;
    color: var(--text-muted);
  }
}
```

---

## 📁 6. Estructura Sugerida de Estilos en Angular

```text
frontend/src/
├── styles.scss                 # Estilos globales e importación de partials
└── assets/styles/
    ├── _variables.scss         # Variables de colores, fuentes, sombras
    ├── _mixins.scss            # Mixins de SCSS (Responsive breakpoints, flex-center)
    ├── _buttons.scss           # Botones y enlaces
    ├── _cards.scss             # Tarjetas, modales y panales
    ├── _tables.scss            # Estilos de tablas y paginadores
    └── _forms.scss             # Campos de texto, selectores, checkboxes
```
