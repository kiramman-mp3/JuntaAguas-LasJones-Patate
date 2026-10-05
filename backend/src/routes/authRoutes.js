const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verificarToken } = require('../middlewares/authMiddleware');
const rateLimit = require('express-rate-limit');

// Rate limiter para login (máximo 10 intentos por cada 15 minutos)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { status: 'ERROR', message: 'Demasiados intentos de inicio de sesión desde esta IP, por favor intente de nuevo en 15 minutos.' }
});

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: [Autenticación]
 *     summary: Iniciar sesión con cédula y contraseña
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [cedula, password]
 *             properties:
 *               cedula: { type: string, example: "1801234567" }
 *               password: { type: string, example: "123456" }
 *     responses:
 *       200: { description: Login exitoso, retorna JWT token. }
 *       401: { description: Credenciales inválidas. }
 */
router.post('/login', loginLimiter, authController.login);

/**
 * @openapi
 * /auth/me:
 *   get:
 *     tags: [Autenticación]
 *     summary: Obtener información del usuario autenticado
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Perfil de usuario. }
 *       401: { description: Token no provisto o inválido. }
 */
router.get('/me', verificarToken, authController.getMe);

/**
 * @openapi
 * /auth/change-password:
 *   post:
 *     tags: [Autenticación]
 *     summary: Cambiar contraseña de la cuenta activa
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nuevaPassword]
 *             properties:
 *               actualPassword: { type: string, example: "123456" }
 *               nuevaPassword: { type: string, example: "NuevaClave2026*" }
 *     responses:
 *       200: { description: Contraseña actualizada correctamente. }
 */
router.post('/change-password', verificarToken, authController.changePassword);

module.exports = router;
