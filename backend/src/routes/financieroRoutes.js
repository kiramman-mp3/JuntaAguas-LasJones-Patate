const express = require('express');
const financieroController = require('../controllers/financieroController');
const { verificarToken, soloAdmin } = require('../middlewares/authMiddleware');

const router = express.Router();

/**
 * @openapi
 * /financiero/conceptos:
 *   get:
 *     tags: [Gestión Financiera]
 *     summary: Conceptos de cobro con su tarifa vigente
 *     security: [{ bearerAuth: [] }]
 * /financiero/tarifas:
 *   post:
 *     tags: [Gestión Financiera]
 *     summary: Registrar tarifa de un concepto
 *     security: [{ bearerAuth: [] }]
 */
router.get('/conceptos', verificarToken, financieroController.getConceptos);
router.post('/tarifas', ...soloAdmin, financieroController.createTarifa);

/**
 * @openapi
 * /financiero/obligaciones:
 *   get:
 *     tags: [Gestión Financiera]
 *     summary: Cuentas por cobrar. El administrador ve todas; un comunero solo las suyas.
 *     security: [{ bearerAuth: [] }]
 *   post:
 *     tags: [Gestión Financiera]
 *     summary: Crear obligación manual
 *     security: [{ bearerAuth: [] }]
 * /financiero/obligaciones/{id}/anular:
 *   post:
 *     tags: [Gestión Financiera]
 *     summary: Anular obligación pendiente
 *     security: [{ bearerAuth: [] }]
 * /financiero/obligaciones/multas:
 *   get:
 *     tags: [Gestión Financiera]
 *     summary: Multas y otros cobros de un comunero por cédula
 *     security: [{ bearerAuth: [] }]
 * /financiero/obligaciones/mensualidades:
 *   get:
 *     tags: [Gestión Financiera]
 *     summary: Cuotas mensuales de agua de un comunero por cédula
 *     security: [{ bearerAuth: [] }]
 * /financiero/periodosobligaciones:
 *   get:
 *     tags: [Gestión Financiera]
 *     summary: Años con obligaciones registradas
 *     security: [{ bearerAuth: [] }]
 */
router.get('/obligaciones', verificarToken, financieroController.getObligaciones);
router.post('/obligaciones', ...soloAdmin, financieroController.createObligacionManual);
router.get('/obligaciones/multas', ...soloAdmin, financieroController.getObligacionesMultas);
router.get('/obligaciones/mensualidades', ...soloAdmin, financieroController.getObligacionesMensualidad);
router.post('/obligaciones/:id/anular', ...soloAdmin, financieroController.anularObligacion);
router.get('/periodosobligaciones', ...soloAdmin, financieroController.getPeriodosObligaciones);

/**
 * @openapi
 * /financiero/pagos:
 *   get:
 *     tags: [Gestión Financiera]
 *     summary: Pagos registrados. El administrador ve todos; un comunero solo los suyos.
 *     security: [{ bearerAuth: [] }]
 *   post:
 *     tags: [Gestión Financiera]
 *     summary: Registrar pago completo de una o varias obligaciones
 *     security: [{ bearerAuth: [] }]
 * /financiero/pagos/{id}/anular:
 *   post:
 *     tags: [Gestión Financiera]
 *     summary: Anular pago y devolver sus obligaciones a PENDIENTE
 *     security: [{ bearerAuth: [] }]
 */
router.get('/pagos', verificarToken, financieroController.getPagos);
router.post('/pagos', ...soloAdmin, financieroController.registrarPago);
router.post('/pagos/:id/anular', ...soloAdmin, financieroController.anularPago);

/**
 * @openapi
 * /financiero/egresos:
 *   get:
 *     tags: [Gestión Financiera]
 *     summary: Egresos y gastos
 *     security: [{ bearerAuth: [] }]
 *   post:
 *     tags: [Gestión Financiera]
 *     summary: Registrar egreso
 *     security: [{ bearerAuth: [] }]
 * /financiero/balance:
 *   get:
 *     tags: [Gestión Financiera]
 *     summary: Balance de ingresos, egresos y cartera pendiente
 *     security: [{ bearerAuth: [] }]
 */
router.get('/egresos', ...soloAdmin, financieroController.getEgresos);
router.post('/egresos', ...soloAdmin, financieroController.createEgreso);
router.get('/balance', ...soloAdmin, financieroController.getBalanceReport);

module.exports = router;
