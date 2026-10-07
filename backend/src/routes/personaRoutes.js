const express = require('express');
const personaController = require('../controllers/personaController');
const { verificarToken, soloAdmin } = require('../middlewares/authMiddleware');

const router = express.Router();

/**
 * @openapi
 * /personas/stats:
 *   get:
 *     tags: [Comuneros (Personas)]
 *     summary: Estadísticas públicas (sin datos personales)
 */
router.get('/stats', personaController.getStatsPublicos);

/**
 * @openapi
 * /personas/consulta/{cedula}:
 *   get:
 *     tags: [Comuneros (Personas)]
 *     summary: Estado de cuenta por cédula (ADMIN o el propio comunero)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: cedula, required: true, schema: { type: string } }
 */
router.get('/consulta/:cedula', verificarToken, personaController.consultaPublicaPorCedula);

/**
 * @openapi
 * /personas:
 *   get:
 *     tags: [Comuneros (Personas)]
 *     summary: Listar comuneros (ADMIN). Paginado, máximo 100 por página.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: busqueda, schema: { type: string } }
 *       - { in: query, name: estado, schema: { type: string, enum: [ACTIVO, INACTIVO] } }
 *       - { in: query, name: page, schema: { type: integer } }
 *       - { in: query, name: limit, schema: { type: integer, maximum: 100 } }
 *   post:
 *     tags: [Comuneros (Personas)]
 *     summary: Registrar comunero (ADMIN). Si crearCuenta es true devuelve passwordTemporal.
 *     security: [{ bearerAuth: [] }]
 */
router.get('/', ...soloAdmin, personaController.getPersonas);
router.post('/', ...soloAdmin, personaController.createPersona);

/**
 * @openapi
 * /personas/{id}:
 *   get:
 *     tags: [Comuneros (Personas)]
 *     summary: Detalle de comunero (ADMIN o el propio comunero)
 *     security: [{ bearerAuth: [] }]
 *   put:
 *     tags: [Comuneros (Personas)]
 *     summary: Actualizar datos personales
 *     security: [{ bearerAuth: [] }]
 */
router.get('/:id', verificarToken, personaController.getPersonaById);
router.put('/:id', ...soloAdmin, personaController.updatePersona);

/**
 * @openapi
 * /personas/{id}/cuenta:
 *   post:
 *     tags: [Comuneros (Personas)]
 *     summary: Crear cuenta de acceso (devuelve passwordTemporal)
 *     security: [{ bearerAuth: [] }]
 *   patch:
 *     tags: [Comuneros (Personas)]
 *     summary: Cambiar el rol (ADMIN/USUARIO) o el estado de la cuenta
 *     security: [{ bearerAuth: [] }]
 * /personas/{id}/cuenta/restablecer-password:
 *   post:
 *     tags: [Comuneros (Personas)]
 *     summary: Generar una contraseña temporal e invalidar sesiones abiertas
 *     security: [{ bearerAuth: [] }]
 */
router.post('/:id/cuenta', ...soloAdmin, personaController.crearCuenta);
router.patch('/:id/cuenta', ...soloAdmin, personaController.actualizarCuenta);
router.post('/:id/cuenta/restablecer-password', ...soloAdmin, personaController.restablecerPassword);

module.exports = router;
