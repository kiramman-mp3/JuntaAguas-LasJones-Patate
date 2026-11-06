const express = require('express');
const inventarioController = require('../controllers/inventarioController');
const { soloAdmin } = require('../middlewares/authMiddleware');

const router = express.Router();

/**
 * @openapi
 * /inventario:
 *   get:
 *     tags: [Inventario]
 *     summary: Bienes activos de la Junta (ADMIN)
 *     security: [{ bearerAuth: [] }]
 *   post:
 *     tags: [Inventario]
 *     summary: Registrar bien (ADMIN)
 *     security: [{ bearerAuth: [] }]
 */
router.get('/', ...soloAdmin, inventarioController.getInventario);
router.post('/', ...soloAdmin, inventarioController.createBien);
router.patch('/:id', ...soloAdmin, inventarioController.updateBien);

module.exports = router;
