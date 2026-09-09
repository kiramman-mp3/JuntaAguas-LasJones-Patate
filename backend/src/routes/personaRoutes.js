const express = require('express');
const router = express.Router();
const personaController = require('../controllers/personaController');
const { verificarToken, verificarRol } = require('../middlewares/authMiddleware');

/**
 * @openapi
 * /personas/consulta/{cedula}:
 *   get:
 *     tags: [Comuneros (Personas)]
 *     summary: ENDPOINT PÚBLICO - Consulta de deudas y multas por cédula de ciudadanía
 *     parameters:
 *       - in: path
 *         name: cedula
 *         required: true
 *         schema: { type: string }
 *         example: "1801234567"
 *     responses:
 *       200: { description: Información del comunero y lista de obligaciones pendientes. }
 *       404: { description: Cédula no encontrada. }
 */
router.get('/consulta/:cedula', personaController.consultaPublicaPorCedula);

/**
 * @openapi
 * /personas:
 *   get:
 *     tags: [Comuneros (Personas)]
 *     summary: Listar comuneros con filtros de búsqueda y paginación
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: busqueda
 *         schema: { type: string }
 *         description: Búsqueda por cédula, nombres o apellidos
 *       - in: query
 *         name: estado
 *         schema: { type: string, enum: [ACTIVO, INACTIVO] }
 *     responses:
 *       200: { description: Lista de comuneros. }
 *   post:
 *     tags: [Comuneros (Personas)]
 *     summary: Registrar un nuevo comunero en la Junta
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [cedula, nombres, apellidos]
 *             properties:
 *               cedula: { type: string, example: "1801234567" }
 *               nombres: { type: string, example: "Juan Carlos" }
 *               apellidos: { type: string, example: "Morales Soria" }
 *               direccion: { type: string, example: "Sector Las Jones Alto" }
 *               telefono: { type: string, example: "032870112" }
 *               celular: { type: string, example: "0991234567" }
 *               email: { type: string, example: "juan.morales@example.com" }
 *     responses:
 *       201: { description: Comunero registrado exitosamente. }
 */
router.get('/', verificarToken, personaController.getPersonas);
router.post('/', verificarToken, verificarRol(['ADMIN', 'SECRETARIO']), personaController.createPersona);

/**
 * @openapi
 * /personas/{id}:
 *   get:
 *     tags: [Comuneros (Personas)]
 *     summary: Obtener perfil detallado de un comunero por ID (lotes, turnos, deudas)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Datos detallados del comunero. }
 *   put:
 *     tags: [Comuneros (Personas)]
 *     summary: Actualizar información de un comunero
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
 *             properties:
 *               nombres: { type: string }
 *               apellidos: { type: string }
 *               direccion: { type: string }
 *               telefono: { type: string }
 *               celular: { type: string }
 *               email: { type: string }
 *               estado: { type: string, enum: [ACTIVO, INACTIVO] }
 *     responses:
 *       200: { description: Comunero actualizado. }
 */
router.get('/:id', verificarToken, personaController.getPersonaById);
router.put('/:id', verificarToken, verificarRol(['ADMIN', 'SECRETARIO']), personaController.updatePersona);

module.exports = router;
