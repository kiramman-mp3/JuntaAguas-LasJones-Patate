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
 * /eventos/{id}/documentos:
 *   get:
 *     tags: [Eventos y Asistencias]
 *     summary: Listar metadatos de documentos registrados del evento (sin contenido binario)
 *     security: [{ bearerAuth: [] }]
 *   post:
 *     tags: [Eventos y Asistencias]
 *     summary: Subir archivo firmado de convocatoria o acta (multipart/form-data)
 *     security: [{ bearerAuth: [] }]
 * /eventos/{id}/pdf-asistencia:
 *   get:
 *     tags: [Eventos y Asistencias]
 *     summary: Generar y descargar hoja de asistencia en PDF para firmas en territorio
 *     security: [{ bearerAuth: [] }]
 * /eventos/{id}/asistencias/{personaId}/justificante:
 *   post:
 *     tags: [Eventos y Asistencias]
 *     summary: Adjuntar archivo de justificación opcional (PDF, PNG, JPG) para una inasistencia
 *     security: [{ bearerAuth: [] }]
 *   get:
 *     tags: [Eventos y Asistencias]
 *     summary: Descargar archivo de justificación de la asistencia
 *     security: [{ bearerAuth: [] }]
 *   delete:
 *     tags: [Eventos y Asistencias]
 *     summary: Eliminar archivo de justificación de la asistencia
 *     security: [{ bearerAuth: [] }]
 */
router.get('/publicos', eventoController.getEventosPublicos);
router.get('/', ...soloAdmin, eventoController.getEventos);
router.post('/', ...soloAdmin, eventoController.createEvento);

router.get('/:id', ...soloAdmin, eventoController.getEventoById);
router.post('/:id/estado', ...soloAdmin, eventoController.cambiarEstado);
router.post('/:id/finalizar', ...soloAdmin, eventoController.finalizarEventoYGenerarMultas);
router.post('/:id/puntos', ...soloAdmin, eventoController.savePuntosAsamblea);
router.post('/:id/asistencias', ...soloAdmin, eventoController.registrarAsistencias);
router.get('/:id/asistencias', ...soloAdmin, eventoController.getAsistencias);
router.post('/:id/asistencias/:personaId/justificante', ...soloAdmin, recibirArchivo, eventoController.subirJustificante);
router.get('/:id/asistencias/:personaId/justificante', ...soloAdmin, eventoController.descargarJustificante);
router.delete('/:id/asistencias/:personaId/justificante', ...soloAdmin, eventoController.eliminarJustificante);
router.get('/:id/pdf-asistencia', ...soloAdmin, eventoController.descargarPDFAsistencia);
router.post('/:id/documentos', ...soloAdmin, recibirArchivo, eventoController.guardarDocumentoEvento);
router.get('/:id/documentos', ...soloAdmin, eventoController.getDocumentosEvento);

module.exports = router;

