const express = require('express');
const dashboardController = require('../controllers/dashboardController');
const { soloAdmin } = require('../middlewares/authMiddleware');

const router = express.Router();

/**
 * @openapi
 * /dashboard/resumen:
 *   get:
 *     tags: [Dashboard]
 *     summary: Indicadores reales de comunidad, finanzas, cobranza y asistencia (ADMIN)
 *     security: [{ bearerAuth: [] }]
 */
router.get('/resumen', ...soloAdmin, dashboardController.getResumen);

module.exports = router;
