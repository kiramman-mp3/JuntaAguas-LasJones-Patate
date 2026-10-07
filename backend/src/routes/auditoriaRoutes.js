const express = require('express');
const router = express.Router();
const auditoriaController = require('../controllers/auditoriaController');
const { verificarToken, verificarRol } = require('../middlewares/authMiddleware');

router.get('/', verificarToken, verificarRol(['ADMIN']), auditoriaController.getAuditoria);

module.exports = router;
