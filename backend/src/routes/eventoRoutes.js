const express = require('express');
const eventoController = require('../controllers/eventoController');
const { soloAdmin } = require('../middlewares/authMiddleware');
const { recibirArchivo } = require('../services/documentStorage');

const router = express.Router();

/**
 * @openapi
 * /eventos/publicos:
 *   get:
 *     tags: [Eventos y Asistencias]
 *     summary: Próximas asambleas y mingas publicadas (sin datos personales)
 * /eventos:
 *   get:
 *     tags: [Eventos y Asistencias]
 *     summary: Listar eventos (ADMIN)
 *     security: [{ bearerAuth: [] }]
 *   post:
 *     tags: [Eventos y Asistencias]
 *     summary: Crear asamblea o minga
 *     security: [{ bearerAuth: [] }]
 */
router.get('/publicos', eventoController.getEventosPublicos);
router.get('/', ...soloAdmin, eventoController.getEventos);
router.post('/', ...soloAdmin, eventoController.createEvento);

router.get('/:id', ...soloAdmin, eventoController.getEventoById);
router.post('/:id/estado', ...soloAdmin, eventoController.cambiarEstado);
router.post('/:id/finalizar', ...soloAdmin, eventoController.finalizarEventoYGenerarMultas);
router.post('/:id/puntos', ...soloAdmin, eventoController.savePuntosAsamblea);
router.post('/:id/puntos/:puntoId/estado', ...soloAdmin, eventoController.cambiarEstadoActaPunto);
router.post('/:id/asistencias', ...soloAdmin, eventoController.registrarAsistencias);
router.get('/:id/asistencias', ...soloAdmin, eventoController.getAsistencias);
router.get('/:id/pdf-asistencia', ...soloAdmin, eventoController.descargarPDFAsistencia);
router.post('/:id/documentos', ...soloAdmin, recibirArchivo, eventoController.guardarDocumentoEvento);
router.get('/:id/documentos', ...soloAdmin, eventoController.getDocumentosEvento);

module.exports = router;
