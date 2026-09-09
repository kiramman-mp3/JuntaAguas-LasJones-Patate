const express = require('express');
const router = express.Router();
const financieroController = require('../controllers/financieroController');
const { verificarToken, verificarRol } = require('../middlewares/authMiddleware');

// Conceptos & Tarifas
router.get('/conceptos', financieroController.getConceptos);
router.post('/tarifas', verificarToken, verificarRol(['ADMIN']), financieroController.createTarifa);

// Obligaciones
router.get('/obligaciones', verificarToken, financieroController.getObligaciones);
router.post('/obligaciones', verificarToken, verificarRol(['ADMIN', 'TESORERO']), financieroController.createObligacionManual);
router.post('/obligaciones/:id/anular', verificarToken, verificarRol(['ADMIN', 'TESORERO']), financieroController.anularObligacion);

// Pagos (Recaudación)
router.get('/pagos', verificarToken, financieroController.getPagos);
router.post('/pagos', verificarToken, verificarRol(['ADMIN', 'TESORERO']), financieroController.registrarPago);

// Egresos
router.get('/egresos', verificarToken, financieroController.getEgresos);
router.post('/egresos', verificarToken, verificarRol(['ADMIN', 'TESORERO']), financieroController.createEgreso);

// Balance General
router.get('/balance', verificarToken, financieroController.getBalanceReport);

module.exports = router;
