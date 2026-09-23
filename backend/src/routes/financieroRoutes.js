const express = require('express');
const router = express.Router();
const financieroController = require('../controllers/financieroController');
const { verificarToken, verificarRol } = require('../middlewares/authMiddleware');

/**
 * @openapi
 * /financiero/conceptos:
 *   get:
 *     tags: [Gestión Financiera]
 *     summary: Obtener catálogo de conceptos de cobro y sus tarifas activas
 *     responses:
 *       200: { description: Catálogo de conceptos de cobro. }
 */
router.get('/conceptos', financieroController.getConceptos);

/**
 * @openapi
 * /financiero/tarifas:
 *   post:
 *     tags: [Gestión Financiera]
 *     summary: Asignar o actualizar la tarifa vigente de un concepto
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [concepto_id, valor, vigencia_desde]
 *             properties:
 *               concepto_id: { type: integer, example: 1 }
 *               valor: { type: number, example: 10.00 }
 *               vigencia_desde: { type: string, example: "2026-01-01" }
 *               vigencia_hasta: { type: string, example: "2026-12-31" }
 *     responses:
 *       201: { description: Tarifa registrada exitosamente. }
 */
router.post('/tarifas', verificarToken, verificarRol(['ADMIN']), financieroController.createTarifa);

/**
 * @openapi
 * /financiero/obligaciones:
 *   get:
 *     tags: [Gestión Financiera]
 *     summary: Listar cuentas por cobrar con filtros (persona, estado, período)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: persona_id
 *         schema: { type: integer }
 *       - in: query
 *         name: estado
 *         schema: { type: string, enum: [PENDIENTE, PAGADA, ANULADA] }
 *     responses:
 *       200: { description: Lista de obligaciones financieras. }
 *   post:
 *     tags: [Gestión Financiera]
 *     summary: Crear una obligación de cobro manual
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [persona_id, concepto_id, fecha_emision, valor]
 *             properties:
 *               persona_id: { type: integer, example: 1 }
 *               concepto_id: { type: integer, example: 1 }
 *               fecha_emision: { type: string, example: "2026-08-01" }
 *               valor: { type: number, example: 10.00 }
 *               observacion: { type: string, example: "Cuota de mantenimiento canal" }
 *     responses:
 *       201: { description: Obligación manual creada. }
 */
router.get('/obligaciones', verificarToken, financieroController.getObligaciones);
router.post('/obligaciones', verificarToken, verificarRol(['ADMIN', 'TESORERO']), financieroController.createObligacionManual);

/**
 * @openapi
 * /financiero/obligaciones/{id}/anular:
 *   post:
 *     tags: [Gestión Financiera]
 *     summary: Anular una obligación pendiente (con registro de auditoría)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [motivo]
 *             properties:
 *               motivo: { type: string, example: "Cobro duplicado por error administrativo" }
 *     responses:
 *       200: { description: Obligación anulada. }
 */
router.post('/obligaciones/:id/anular', verificarToken, verificarRol(['ADMIN', 'TESORERO']), financieroController.anularObligacion);

/**
 * @openapi
 * /financiero/pagos:
 *   get:
 *     tags: [Gestión Financiera]
 *     summary: Consultar historial de pagos y recaudación realizada
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Historial de pagos. }
 *   post:
 *     tags: [Gestión Financiera]
 *     summary: REGISTRO DE PAGO COMPLETO (Transacción imborrable - No se permiten pagos parciales)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [persona_id, obligacionesIds]
 *             properties:
 *               persona_id: { type: integer, example: 1 }
 *               metodo: { type: string, enum: [EFECTIVO, TRANSFERENCIA, DEPOSITO, OTRO], example: "EFECTIVO" }
 *               referencia: { type: string, example: "REC-00123" }
 *               observacion: { type: string, example: "Pago completo cuota agosto" }
 *               obligacionesIds: { type: array, items: { type: integer }, example: [101, 102] }
 *     responses:
 *       201: { description: Pago registrado y obligaciones cerradas como PAGADA. }
 */
router.get('/pagos', verificarToken, financieroController.getPagos);
router.post('/pagos', verificarToken, verificarRol(['ADMIN', 'TESORERO']), financieroController.registrarPago);
router.post('/pagos/:id/anular', verificarToken, verificarRol(['ADMIN', 'TESORERO']), financieroController.anularPago);

/**
 * @openapi
 * /financiero/egresos:
 *   get:
 *     tags: [Gestión Financiera]
 *     summary: Listar gastos y egresos realizados por la Junta
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Lista de egresos. }
 *   post:
 *     tags: [Gestión Financiera]
 *     summary: Registrar un egreso o compra realizada
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fecha, concepto, valor]
 *             properties:
 *               proveedor_id: { type: integer, example: 1 }
 *               fecha: { type: string, example: "2026-08-10" }
 *               concepto: { type: string, example: "Compra de tubería PVC para canal secundario" }
 *               numero_factura: { type: string, example: "001-002-00045612" }
 *               valor: { type: number, example: 150.00 }
 *     responses:
 *       201: { description: Egreso registrado. }
 */
router.get('/egresos', verificarToken, financieroController.getEgresos);
router.post('/egresos', verificarToken, verificarRol(['ADMIN', 'TESORERO']), financieroController.createEgreso);

/**
 * @openapi
 * /financiero/balance:
 *   get:
 *     tags: [Gestión Financiera]
 *     summary: Generar reporte de Balance General Al Día (Total Ingresos - Total Egresos)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: desde
 *         schema: { type: string, example: "2026-01-01" }
 *       - in: query
 *         name: hasta
 *         schema: { type: string, example: "2026-12-31" }
 *     responses:
 *       200: { description: Reporte de balance financiero al día. }
 */
router.get('/balance', verificarToken, financieroController.getBalanceReport);

module.exports = router;
