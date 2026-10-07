const express = require('express');
const router = express.Router();
const inventarioController = require('../controllers/inventarioController');
const { verificarToken, verificarRol } = require('../middlewares/authMiddleware');

router.get('/', inventarioController.getInventario);
router.post('/', verificarToken, verificarRol(['ADMIN', 'TESORERO']), inventarioController.createBien);

module.exports = router;
