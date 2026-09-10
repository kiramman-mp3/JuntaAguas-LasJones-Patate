const express = require('express');
const router = express.Router();
const eventoController = require('../controllers/eventoController');
const { verificarToken, verificarRol } = require('../middlewares/authMiddleware');

router.get('/', eventoController.getEventos);
router.get('/:id', eventoController.getEventoById);

router.post('/', verificarToken, verificarRol(['ADMIN', 'SECRETARIO']), eventoController.createEvento);
router.post('/:id/puntos', verificarToken, verificarRol(['ADMIN', 'SECRETARIO']), eventoController.savePuntosAsamblea);
router.post('/:id/asistencias', verificarToken, verificarRol(['ADMIN', 'SECRETARIO']), eventoController.registrarAsistencias);
router.post('/:id/finalizar', verificarToken, verificarRol(['ADMIN', 'SECRETARIO']), eventoController.finalizarEventoYGenerarMultas);

module.exports = router;
