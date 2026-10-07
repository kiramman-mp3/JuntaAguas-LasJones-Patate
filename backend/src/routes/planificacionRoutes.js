const express = require('express');
const router = express.Router();
const planificacionController = require('../controllers/planificacionController');
const { verificarToken, verificarRol } = require('../middlewares/authMiddleware');

router.get('/', planificacionController.getPlanes);
router.post('/', verificarToken, verificarRol(['ADMIN']), planificacionController.createPlan);
router.post('/:planId/actividades', verificarToken, verificarRol(['ADMIN']), planificacionController.addActividadPlan);

module.exports = router;
