const express = require('express');
const router = express.Router();
const whatsappController = require('../controllers/whatsappController');
const { verificarToken, verificarRol } = require('../middlewares/authMiddleware');

// Rutas protegidas para administradores / secretarios
router.get('/status', verificarToken, verificarRol(['ADMIN', 'SECRETARIO']), whatsappController.getStatus);
router.post('/init', verificarToken, verificarRol(['ADMIN', 'SECRETARIO']), whatsappController.initSession);
router.post('/logout', verificarToken, verificarRol(['ADMIN', 'SECRETARIO']), whatsappController.logoutSession);
router.post('/notificar-minga', verificarToken, verificarRol(['ADMIN', 'SECRETARIO']), whatsappController.notificarMinga);

module.exports = router;

