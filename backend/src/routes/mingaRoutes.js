const router = require('express').Router();
const controller = require('../controllers/mingaController');
const { soloAdmin } = require('../middlewares/authMiddleware');

router.use(...soloAdmin);
router.get('/:id/asistencias', controller.getAsistencias);
router.post('/:id/estado', controller.cambiarEstado);
router.post('/:id/finalizar', controller.finalizar);
router.post('/:id/asistencias', controller.registrarAsistencias);

module.exports = router;
