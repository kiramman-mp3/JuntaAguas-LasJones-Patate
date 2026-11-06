const express = require('express');
const personaController = require('../controllers/personaController');
const { verificarToken, soloAdmin } = require('../middlewares/authMiddleware');

const router = express.Router();

/**
 * @openapi
 * /personas/stats:
 *   get:
 *     tags: [Usuarios (Personas)]
 *     summary: Estadísticas públicas (sin datos personales)
 */
router.get('/stats', personaController.getStatsPublicos);

/**
 * @openapi
 * /personas/consulta/{cedula}:
 *   get:
 *     tags: [Usuarios (Personas)]
 *     summary: Estado de cuenta por cédula (ADMIN o el propio usuario)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: cedula, required: true, schema: { type: string } }
 */
router.get('/consulta/:cedula', verificarToken, personaController.consultaPublicaPorCedula);

/**
 * @openapi
 * /personas:
 *   get:
 *     tags: [Usuarios (Personas)]
 *     summary: Listar usuarios (ADMIN). Paginado, máximo 100 por página.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: busqueda, schema: { type: string } }
 *       - { in: query, name: estado, schema: { type: string, enum: [ACTIVO, INACTIVO] } }
 *       - { in: query, name: page, schema: { type: integer } }
 *       - { in: query, name: limit, schema: { type: integer, maximum: 100 } }
 *   post:
 *     tags: [Usuarios (Personas)]
 *     summary: Registrar usuario (ADMIN). Si crearCuenta es true devuelve passwordTemporal.
 *     security: [{ bearerAuth: [] }]
 */
router.get('/', ...soloAdmin, personaController.getPersonas);
router.post('/', ...soloAdmin, personaController.createPersona);

/**
 * @openapi
 * /personas/cuentas-bloqueadas:
 *   get:
 *     tags: [Usuarios (Personas)]
 *     summary: Cuentas con el inicio de sesión bloqueado ahora mismo por intentos fallidos (ADMIN)
 *     security: [{ bearerAuth: [] }]
 */
router.get('/cuentas-bloqueadas', ...soloAdmin, personaController.getCuentasBloqueadas);

/**
 * @openapi
 * /personas/{id}:
 *   get:
 *     tags: [Usuarios (Personas)]
 *     summary: Detalle de usuario (ADMIN o el propio usuario)
 *     security: [{ bearerAuth: [] }]
 *   put:
 *     tags: [Usuarios (Personas)]
 *     summary: Actualizar datos personales
 *     security: [{ bearerAuth: [] }]
 */
router.get('/:id', verificarToken, personaController.getPersonaById);
router.put('/:id', ...soloAdmin, personaController.updatePersona);
router.delete('/:id', ...soloAdmin, personaController.deletePersona);

/**
 * @openapi
 * /personas/{id}/cuenta:
 *   post:
 *     tags: [Usuarios (Personas)]
 *     summary: Crear cuenta de acceso (devuelve passwordTemporal)
 *     security: [{ bearerAuth: [] }]
 *   patch:
 *     tags: [Usuarios (Personas)]
 *     summary: Cambiar el rol (ADMIN/USUARIO) o el estado de la cuenta
 *     security: [{ bearerAuth: [] }]
 * /personas/{id}/cuenta/restablecer-password:
 *   post:
 *     tags: [Usuarios (Personas)]
 *     summary: Generar una contraseña temporal e invalidar sesiones abiertas
 *     security: [{ bearerAuth: [] }]
 */
router.post('/:id/cuenta', ...soloAdmin, personaController.crearCuenta);
router.patch('/:id/cuenta', ...soloAdmin, personaController.actualizarCuenta);
router.post('/:id/cuenta/restablecer-password', ...soloAdmin, personaController.restablecerPassword);

/**
 * @openapi
 * /personas/{id}/cuenta/desbloquear:
 *   post:
 *     tags: [Usuarios (Personas)]
 *     summary: Levantar el bloqueo de inicio de sesión de la cuenta sin cambiar su contraseña (ADMIN)
 *     security: [{ bearerAuth: [] }]
 */
router.post('/:id/cuenta/desbloquear', ...soloAdmin, personaController.desbloquearCuenta);

module.exports = router;
