const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ruta base de prueba
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'API del Sistema Integrado de Gestión - Junta La Jones funcionando correctamente.',
    timestamp: new Date().toISOString()
  });
});

// Inicialización del servidor
app.listen(PORT, () => {
  console.log(`[Backend Server] Ejecutándose en http://localhost:${PORT}`);
});
