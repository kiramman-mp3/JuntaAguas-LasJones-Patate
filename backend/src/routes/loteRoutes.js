const express = require('express');
const router = express.Router();
const loteController = require('../controllers/loteController');
const { verificarToken, verificarRol } = require('../middlewares/authMiddleware');

// Sectores
router.get('/sectores', loteController.getSectores);
router.post('/sectores', verificarToken, verificarRol(['ADMIN']), loteController.createSector);

// Lotes
/**
 * @swagger
 * /lotes/sugerir-codigo:
 *   get:
 *     summary: Sugerir un código libre de lote para un sector activo
 *     tags: [Lotes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: sector_id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *     responses:
 *       200:
 *         description: Código sugerido (no reservado; se comprueba nuevamente al guardar)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: OK
 *                 data:
 *                   type: object
 *                   properties:
 *                     codigo:
 *                       type: string
 *                       example: LJA-004
 *       400:
 *         description: Sector inválido
 *       401:
 *         description: Token requerido
 *       403:
 *         description: Requiere rol ADMIN o SECRETARIO
 *       404:
 *         description: Sector inexistente o inactivo
 *       409:
 *         description: Consecutivos agotados
 */
router.get('/sugerir-codigo', verificarToken, verificarRol(['ADMIN', 'SECRETARIO']), loteController.sugerirCodigo);
router.get('/', loteController.getLotes);
router.post('/', verificarToken, verificarRol(['ADMIN', 'SECRETARIO']), loteController.createLote);
router.post('/:loteId/vincular-persona', verificarToken, verificarRol(['ADMIN', 'SECRETARIO']), loteController.linkPersonaLote);

module.exports = router;
