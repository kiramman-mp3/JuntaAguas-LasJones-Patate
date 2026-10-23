const express = require('express');
const financieroController = require('../controllers/financieroController');
const comprobantes = require('../controllers/pagoComprobanteController');
const { recibirArchivo } = require('../services/documentStorage');
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
 *   get:
 *     tags: [Gestión Financiera]
 *     summary: Historial de tarifas por concepto
 *     security: [{ bearerAuth: [] }]
 *   post:
 *     tags: [Gestión Financiera]
 *     summary: Registrar tarifa (cierra la vigencia de la anterior)
 *     security: [{ bearerAuth: [] }]
 */
router.get('/conceptos', verificarToken, financieroController.getConceptos);
router.get('/tarifas', ...soloAdmin, financieroController.getTarifas);
router.post('/tarifas', ...soloAdmin, financieroController.createTarifa);

/**
 * @openapi
 * /financiero/obligaciones:
 *   get:
 *     tags: [Gestión Financiera]
 *     summary: Cuentas por cobrar. El administrador ve todas; un usuario solo las suyas.
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
 *     summary: Multas y otros cobros de un usuario por cédula
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
router.post('/obligaciones/:id/anular', ...soloAdmin, financieroController.anularObligacion);
router.get('/periodosobligaciones', ...soloAdmin, financieroController.getPeriodosObligaciones);

/**
 * @openapi
 * /financiero/pagos:
 *   get:
 *     tags: [Gestión Financiera]
 *     summary: Pagos registrados. El administrador ve todos; un usuario solo los suyos.
 *     security: [{ bearerAuth: [] }]
 *   post:
 *     tags: [Gestión Financiera]
 *     summary: Registrar pago completo por transferencia o depósito, con referencia bancaria obligatoria
 *     security: [{ bearerAuth: [] }]
 * /financiero/pagos/{id}/anular:
 *   post:
 *     tags: [Gestión Financiera]
 *     summary: Anular pago y devolver sus obligaciones a PENDIENTE
 *     security: [{ bearerAuth: [] }]
 */
router.get('/pagos', verificarToken, financieroController.getPagos);
router.get('/pagos/:id', verificarToken, financieroController.getPagoById);
/**
 * @openapi
 * /financiero/pagos/{id}/comprobante:
 *   post:
 *     tags: [Gestión Financiera]
 *     summary: Adjuntar o reemplazar comprobante bancario de un pago vigente (ADMIN)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [archivo]
 *             properties:
 *               archivo: { type: string, format: binary, description: 'PDF/JPG/PNG, hasta 10 MB' }
 *     responses:
 *       '200': { description: Comprobante guardado }
 *   get:
 *     tags: [Gestión Financiera]
 *     summary: Descargar comprobante bancario (ADMIN o titular del pago)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 *     responses:
 *       '200': { description: Archivo del comprobante bancario }
 */
router.post('/pagos/:id/comprobante', ...soloAdmin, recibirArchivo, comprobantes.subir);
router.get('/pagos/:id/comprobante', verificarToken, comprobantes.descargar);
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
 * /financiero/historial:
 *   get:
 *     tags: [Gestión Financiera]
 *     summary: Historial anual de ingresos, egresos y balance agrupado por mes
 *     security: [{ bearerAuth: [] }]
 */
router.get('/egresos', ...soloAdmin, financieroController.getEgresos);
router.post('/egresos', ...soloAdmin, financieroController.createEgreso);
router.get('/balance', ...soloAdmin, financieroController.getBalanceReport);
router.get('/historial', ...soloAdmin, financieroController.getHistorialAnual);
/**
 * @openapi
 * /financiero/agua-anual/obligaciones:
 *   post:
 *     tags: [Gestión Financiera]
 *     summary: Emitir (o simular con simular=true) la obligación anual de agua del año para los usuarios activos con lote (ADMIN). Sin valor_total usa la tarifa AGUA_ANUAL vigente al 1 de enero.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [anio]
 *             properties:
 *               anio: { type: integer, example: 2026 }
 *               valor_total: { type: number, example: 42 }
 *               simular: { type: boolean, example: false }
 *     responses:
 *       '201': { description: Obligaciones generadas; las ya existentes del año se respetan }
 * /financiero/agua-anual/resumen:
 *   get:
 *     tags: [Gestión Financiera]
 *     summary: Obligaciones anuales de agua emitidas, cobradas y pendientes de un año (ADMIN)
 *     security: [{ bearerAuth: [] }]
 * /financiero/agua-anual/obligaciones/{personaId}:
 *   get:
 *     tags: [Gestión Financiera]
 *     summary: Obligaciones anuales de agua pendientes de un usuario (ADMIN)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: personaId, required: true, schema: { type: integer } }
 * /financiero/agua-anual/pagos:
 *   post:
 *     tags: [Gestión Financiera]
 *     summary: Registrar el pago de obligaciones anuales de agua por transferencia o depósito (ADMIN)
 *     security: [{ bearerAuth: [] }]
 */
router.get('/agua-anual/resumen', ...soloAdmin, financieroController.getResumenAnualAgua);
router.post('/agua-anual/obligaciones', ...soloAdmin, financieroController.generarObligacionesAnualesAgua);
router.get('/agua-anual/obligaciones/:personaId', ...soloAdmin, financieroController.getObligacionesAnualesAgua);
router.post('/agua-anual/pagos', ...soloAdmin, financieroController.registrarPagoAnualAgua);

module.exports = router;
