const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const env = require('./config/env');
const db = require('./config/db');
const apiRouter = require('./routes/index');
const errorHandler = require('./middlewares/errorHandler');
const { autenticacionOpcional } = require('./middlewares/authMiddleware');
const { servirDocumento } = require('./controllers/documentoController');

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', env.TRUST_PROXY);

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'same-site' },
  // Solo lo que usa la aplicación: mapas de OpenStreetMap, PDFs y QR generados en el navegador.
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:', 'https://*.tile.openstreetmap.org'],
      fontSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      frameSrc: ["'self'", 'blob:'],
      workerSrc: ["'self'", 'blob:'],
      objectSrc: ["'none'"],
      // Puede desplegarse en red local sin HTTPS; detrás de un proxy con HTTPS no hace falta forzarlo.
      upgradeInsecureRequests: null
    }
  }
}));
app.use(cors({ origin: env.FRONTEND_URL }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

// Documentos subidos: el acceso depende del tipo de documento (ver documentoController).
app.get('/uploads/documentos/:archivo', autenticacionOpcional, servirDocumento);

// Comprobación de salud: verifica también la conexión con la base de datos.
app.get('/api/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'OK', database: 'OK', timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'ERROR', database: 'UNAVAILABLE', timestamp: new Date().toISOString() });
  }
});

// La documentación interactiva solo se publica fuera de producción.
if (!env.esProduccion) {
  const swaggerUi = require('swagger-ui-express');
  const { swaggerSpec } = require('./config/swagger');
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}

app.use('/api', apiRouter);

// Frontend compilado (ng build): se sirve desde el mismo origen que la API.
// Los archivos con hash se guardan en caché un año; index.html nunca, para recibir cada versión nueva.
const frontendDist = env.FRONTEND_DIST;
if (fs.existsSync(path.join(frontendDist, 'index.html'))) {
  app.use(express.static(frontendDist, {
    index: false,
    maxAge: '1y',
    immutable: true,
    setHeaders: (res, archivo) => {
      if (archivo.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
    }
  }));
  // Rutas de Angular (/admin/cobros…): cualquier GET que no sea de la API ni un archivo devuelve la SPA.
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api') || req.path.startsWith('/uploads') || path.extname(req.path)) return next();
    res.setHeader('Cache-Control', 'no-cache');
    return res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

app.use(errorHandler.notFoundHandler);
app.use(errorHandler);

module.exports = app;
