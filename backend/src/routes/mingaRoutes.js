const router = require('express').Router();
const controller = require('../controllers/mingaController');
const { verificarToken, verificarRol } = require('../middlewares/authMiddleware');

router.use(verificarToken, verificarRol(['ADMIN', 'SECRETARIO']));
router.post('/:id/estado', controller.cambiarEstado);
router.post('/:id/finalizar', controller.finalizar);
router.post('/:id/asistencias', controller.registrarAsistencias);

module.exports = router;
