const path = require('path');
const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
require('dotenv').config();

const apiRouter = require('./routes/index');
const errorHandler = require('./middlewares/errorHandler');
const { swaggerSpec } = require('./config/swagger');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares globales
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Servir archivos estáticos subidos (PDFs, imágenes)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));


// Ruta de comprobación de salud (Health check)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'API del Sistema Integrado de Gestión - Junta La Jones funcionando correctamente.',
    version: '1.0.0',
    swaggerDocs: `http://localhost:${PORT}/api-docs`,
    timestamp: new Date().toISOString()
  });
});

// Documentación Swagger UI (Accesible en /api-docs)
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Montar API principal en /api
app.use('/api', apiRouter);

// Middleware global de manejo de errores
app.use(errorHandler);

// Inicializar Servidor Express
app.listen(PORT, () => {
  console.log(`[Servidor Backend] Ejecutándose en http://localhost:${PORT}`);
  console.log(`[Documentación Swagger UI] http://localhost:${PORT}/api-docs`);
  console.log(`[API Base] http://localhost:${PORT}/api`);
});
