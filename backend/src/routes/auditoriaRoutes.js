const express = require('express');
const auditoriaController = require('../controllers/auditoriaController');
const { soloAdmin } = require('../middlewares/authMiddleware');

const router = express.Router();

/**
 * @openapi
 * /auditoria:
 *   get:
 *     tags: [Auditoría]
 *     summary: Bitácora de auditoría (ADMIN, máximo 500 registros)
 *     security: [{ bearerAuth: [] }]
 */
router.get('/', ...soloAdmin, auditoriaController.getAuditoria);

module.exports = router;
