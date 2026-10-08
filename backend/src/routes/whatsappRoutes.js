const express = require('express');
const whatsappController = require('../controllers/whatsappController');
const { soloAdmin } = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(...soloAdmin);

/**
 * @openapi
 * /whatsapp/estado:
 *   get:
 *     tags: [WhatsApp]
 *     summary: Estado de la conexión y grupo de convocatorias (no inicia WhatsApp)
 *     description: estado es DESCONECTADO, INICIANDO, ESPERANDO_QR, CONECTADO, NO_DISPONIBLE o NO_CONFIGURADO.
 *     security: [{ bearerAuth: [] }]
 */
router.get('/estado', whatsappController.getEstado);

/**
 * @openapi
 * /whatsapp/sesion/iniciar:
 *   post:
 *     tags: [WhatsApp]
 *     summary: Iniciar WhatsApp Web (muestra un QR si el teléfono no está vinculado)
 *     security: [{ bearerAuth: [] }]
 * /whatsapp/sesion/cerrar:
 *   post:
 *     tags: [WhatsApp]
 *     summary: Desvincular el teléfono de la Junta
 *     security: [{ bearerAuth: [] }]
 */
router.post('/sesion/iniciar', whatsappController.iniciarSesion);
router.post('/sesion/cerrar', whatsappController.cerrarSesion);

/**
 * @openapi
 * /whatsapp/grupos:
 *   get:
 *     tags: [WhatsApp]
 *     summary: Grupos de la cuenta vinculada
 *     security: [{ bearerAuth: [] }]
 * /whatsapp/grupo:
 *   put:
 *     tags: [WhatsApp]
 *     summary: Elegir el grupo donde se publican las convocatorias
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [grupoId]
 *             properties:
 *               grupoId: { type: string, example: "120363000000000001@g.us" }
 */
router.get('/grupos', whatsappController.getGrupos);
router.put('/grupo', whatsappController.guardarGrupo);

/**
 * @openapi
 * /whatsapp/convocatorias:
 *   post:
 *     tags: [WhatsApp]
 *     summary: Publicar la convocatoria de una asamblea o minga en el grupo
 *     description: >
 *       Responde 409 con codigo GRUPO_NO_CONFIGURADO si no hay grupo elegido, o CONVOCATORIA_YA_ENVIADA
 *       si ya se publicó (repita con reenviar=true). El evento pasa a CONVOCADO.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [eventoId]
 *             properties:
 *               eventoId: { type: integer }
 *               reenviar: { type: boolean, default: false }
 */
router.post('/convocatorias', whatsappController.enviarConvocatoria);

module.exports = router;
