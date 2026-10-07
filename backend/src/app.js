const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const env = require('./config/env');
const db = require('./config/db');
const apiRouter = require('./routes/index');
const errorHandler = require('./middlewares/errorHandler');
const { verificarToken } = require('./middlewares/authMiddleware');

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', env.TRUST_PROXY);

app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));
app.use(cors({ origin: env.FRONTEND_URL }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

// Archivos subidos (PDFs firmados). Requieren autenticación.
app.use('/uploads', verificarToken, express.static(path.join(env.UPLOADS_DIR), { dotfiles: 'deny', index: false }));

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

app.use(errorHandler.notFoundHandler);
app.use(errorHandler);

module.exports = app;
