const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verificarToken } = require('../middlewares/authMiddleware');

// Public login
router.post('/login', authController.login);

// Protected user profile and change password
router.get('/me', verificarToken, authController.getMe);
router.post('/change-password', verificarToken, authController.changePassword);

module.exports = router;
