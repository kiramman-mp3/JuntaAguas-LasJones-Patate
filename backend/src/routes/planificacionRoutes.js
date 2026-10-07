const express = require('express');
const planificacionController = require('../controllers/planificacionController');
const { soloAdmin } = require('../middlewares/authMiddleware');

const router = express.Router();

/**
 * @openapi
 * /planes:
 *   get:
 *     tags: [Planificación Anual]
 *     summary: Planes anuales con sus actividades (ADMIN)
 *     security: [{ bearerAuth: [] }]
 *   post:
 *     tags: [Planificación Anual]
 *     summary: Crear plan anual (ADMIN)
 *     security: [{ bearerAuth: [] }]
 * /planes/{planId}/actividades:
 *   post:
 *     tags: [Planificación Anual]
 *     summary: Agregar actividad al plan (ADMIN)
 *     security: [{ bearerAuth: [] }]
 */
router.get('/', ...soloAdmin, planificacionController.getPlanes);
router.post('/', ...soloAdmin, planificacionController.createPlan);
router.post('/:planId/actividades', ...soloAdmin, planificacionController.addActividadPlan);

module.exports = router;
