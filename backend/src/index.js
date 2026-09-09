const express = require('express');
const cors = require('cors');
require('dotenv').config();

const apiRouter = require('./routes/index');
const errorHandler = require('./middlewares/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares globales
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ruta de comprobación de salud (Health check)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'API del Sistema Integrado de Gestión - Junta La Jones funcionando correctamente.',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Montar API v1
app.use('/api/v1', apiRouter);

// Middleware global de manejo de errores
app.use(errorHandler);

// Inicializar Servidor Express
app.listen(PORT, () => {
  console.log(`[Servidor Backend] Ejecutándose en http://localhost:${PORT}`);
  console.log(`[Health Check] http://localhost:${PORT}/api/health`);
  console.log(`[API v1 Base] http://localhost:${PORT}/api/v1`);
});
