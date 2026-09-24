const express = require('express');
const router = express.Router();
const eventoController = require('../controllers/eventoController');
const { verificarToken, verificarRol } = require('../middlewares/authMiddleware');

router.get('/', eventoController.getEventos);
router.get('/publicos', eventoController.getEventosPublicos);
router.get('/:id', eventoController.getEventoById);

router.post('/', verificarToken, verificarRol(['ADMIN', 'SECRETARIO']), eventoController.createEvento);
router.post('/:id/puntos', verificarToken, verificarRol(['ADMIN', 'SECRETARIO']), eventoController.savePuntosAsamblea);
router.post('/:id/asistencias', verificarToken, verificarRol(['ADMIN', 'SECRETARIO']), eventoController.registrarAsistencias);
router.get('/:id/asistencias', verificarToken, eventoController.getAsistencias);
router.post('/:id/documentos', verificarToken, verificarRol(['ADMIN', 'SECRETARIO']), eventoController.guardarDocumentoEvento);
router.get('/:id/documentos', eventoController.getDocumentosEvento);

module.exports = router;

