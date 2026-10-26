const router = require('express').Router();
const controller = require('../controllers/mingaController');
const { soloAdmin } = require('../middlewares/authMiddleware');
const { recibirArchivo } = require('../services/documentStorage');

router.use(...soloAdmin);
router.get('/:id/asistencias', controller.getAsistencias);
router.post('/:id/estado', controller.cambiarEstado);
router.post('/:id/finalizar', controller.finalizar);
router.post('/:id/asistencias', controller.registrarAsistencias);
router.post('/:id/asistencias/:personaId/justificante', recibirArchivo, controller.subirJustificante);
router.get('/:id/asistencias/:personaId/justificante', controller.descargarJustificante);
router.delete('/:id/asistencias/:personaId/justificante', controller.eliminarJustificante);

module.exports = router;

