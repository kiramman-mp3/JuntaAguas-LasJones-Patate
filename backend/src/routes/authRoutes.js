const express = require('express');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const authController = require('../controllers/authController');
const { verificarToken, verificarTokenOCambioPassword } = require('../middlewares/authMiddleware');
const env = require('../config/env');

const router = express.Router();

const QUINCE_MINUTOS = 15 * 60 * 1000;
const opcionesLimite = { windowMs: QUINCE_MINUTOS, standardHeaders: 'draft-8', legacyHeaders: false };

/**
 * Dos límites para el inicio de sesión (además, cada cuenta se bloquea tras 5 intentos fallidos):
 * - por IP y cédula: frena a quien prueba contraseñas de una cuenta sin bloquear a los demás usuarios
 *   que comparten la misma IP (la red de la Junta o un proxy mal configurado, ver TRUST_PROXY);
 * - por IP, más amplio: frena a quien recorre muchas cédulas desde un mismo equipo.
 */
const limitePorCuenta = rateLimit({
  ...opcionesLimite,
  limit: env.esTest ? 1000 : 10,
  keyGenerator: (req) => `${ipKeyGenerator(req.ip)}|${String(req.body?.cedula ?? '').trim().slice(0, 20)}`,
  message: { status: 'ERROR', message: 'Demasiados intentos para esta cédula. Intente de nuevo en 15 minutos.' }
});
const limitePorIp = rateLimit({
  ...opcionesLimite,
  limit: env.esTest ? 1000 : 100,
  message: { status: 'ERROR', message: 'Demasiados intentos de inicio de sesión desde esta red. Intente de nuevo en 15 minutos.' }
});
const loginLimiter = [limitePorIp, limitePorCuenta];

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
