const express = require('express');
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/authController');
const { verificarToken, verificarTokenOCambioPassword } = require('../middlewares/authMiddleware');
const env = require('../config/env');

const router = express.Router();

// Límite por IP; además cada cuenta se bloquea tras 5 intentos fallidos (ver authController).
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.esTest ? 1000 : 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { status: 'ERROR', message: 'Demasiados intentos de inicio de sesión desde esta red. Intente de nuevo en 15 minutos.' }
});

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: [Autenticación]
 *     summary: Iniciar sesión con cédula y contraseña
 *     description: Si la contraseña es temporal, el token devuelto solo permite llamar a /auth/change-password.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [cedula, password]
 *             properties:
 *               cedula: { type: string, example: "1802345678" }
 *               password: { type: string }
 *     responses:
 *       200: { description: Token JWT y datos del usuario. }
 *       401: { description: Credenciales inválidas o cuenta bloqueada. }
 */
router.post('/login', loginLimiter, authController.login);

/**
 * @openapi
 * /auth/me:
 *   get:
 *     tags: [Autenticación]
 *     summary: Perfil de la cuenta autenticada
 *     security: [{ bearerAuth: [] }]
 */
router.get('/me', verificarToken, authController.getMe);

/**
 * @openapi
 * /auth/change-password:
 *   post:
 *     tags: [Autenticación]
 *     summary: Cambiar la contraseña (también con el token temporal)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [actualPassword, nuevaPassword]
 *             properties:
 *               actualPassword: { type: string }
 *               nuevaPassword: { type: string, description: 'Mínimo 8 caracteres, letras y números.' }
 */
router.post('/change-password', verificarTokenOCambioPassword, authController.changePassword);

module.exports = router;
