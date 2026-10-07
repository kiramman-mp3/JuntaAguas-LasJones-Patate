const express = require('express');
const turnoController = require('../controllers/turnoController');
const { verificarToken, soloAdmin } = require('../middlewares/authMiddleware');

const router = express.Router();

/**
 * @openapi
 * /turnos:
 *   get:
 *     tags: [Turnos de Agua]
 *     summary: Turnos activos. El administrador ve todos; un comunero solo los suyos.
 *     security: [{ bearerAuth: [] }]
 *   post:
 *     tags: [Turnos de Agua]
 *     summary: Asignar turno (genera cobro si es adicional)
 *     security: [{ bearerAuth: [] }]
 * /turnos/{id}:
 *   put:
 *     tags: [Turnos de Agua]
 *     summary: Modificar turno
 *     security: [{ bearerAuth: [] }]
 *   delete:
 *     tags: [Turnos de Agua]
 *     summary: Desactivar turno
 *     security: [{ bearerAuth: [] }]
 */
router.get('/', verificarToken, turnoController.getTurnos);
router.post('/', ...soloAdmin, turnoController.createTurno);
router.put('/:id', ...soloAdmin, turnoController.updateTurno);
router.delete('/:id', ...soloAdmin, turnoController.deleteTurno);

module.exports = router;
