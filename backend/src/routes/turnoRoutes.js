const express = require('express');
const turnoController = require('../controllers/turnoController');
const { verificarToken, soloAdmin } = require('../middlewares/authMiddleware');

const router = express.Router();

/**
 * @openapi
 * /turnos:
 *   get:
 *     tags: [Turnos de Agua]
 *     summary: Turnos activos. El administrador ve todos; un usuario solo los suyos.
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
 *     summary: Desactivar turno de agua (desactivación lógica para trazabilidad e historial)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID numérico del turno a desactivar
 *     responses:
 *       200:
 *         description: Turno de agua desactivado exitosamente (estado pasa a INACTIVO)
 *       404:
 *         description: Turno no encontrado o ya desactivado
 */
router.get('/cronograma', verificarToken, turnoController.getCronogramaPorSectores);
router.get('/cronograma-publico', turnoController.getCronogramaPublico);
router.get('/publicos/cronograma', turnoController.getCronogramaPublico);
router.get('/', verificarToken, turnoController.getTurnos);
router.post('/', ...soloAdmin, turnoController.createTurno);
router.put('/:id', ...soloAdmin, turnoController.updateTurno);
router.delete('/:id', ...soloAdmin, turnoController.deleteTurno);

module.exports = router;
