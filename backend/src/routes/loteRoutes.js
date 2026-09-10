const express = require('express');
const router = express.Router();
const loteController = require('../controllers/loteController');
const { verificarToken, verificarRol } = require('../middlewares/authMiddleware');

// Sectores
router.get('/sectores', loteController.getSectores);
router.post('/sectores', verificarToken, verificarRol(['ADMIN']), loteController.createSector);

// Lotes
router.get('/', loteController.getLotes);
router.post('/', verificarToken, verificarRol(['ADMIN', 'SECRETARIO']), loteController.createLote);
router.post('/:loteId/vincular-persona', verificarToken, verificarRol(['ADMIN', 'SECRETARIO']), loteController.linkPersonaLote);

module.exports = router;
