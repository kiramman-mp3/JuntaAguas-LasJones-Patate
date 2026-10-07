const express = require('express');
const router = express.Router();
const turnoController = require('../controllers/turnoController');
const { verificarToken, verificarRol } = require('../middlewares/authMiddleware');

router.get('/', turnoController.getTurnos);
router.post('/', verificarToken, verificarRol(['ADMIN', 'SECRETARIO']), turnoController.createTurno);
router.put('/:id', verificarToken, verificarRol(['ADMIN', 'SECRETARIO']), turnoController.updateTurno);
router.delete('/:id', verificarToken, verificarRol(['ADMIN', 'SECRETARIO']), turnoController.deleteTurno);

module.exports = router;
