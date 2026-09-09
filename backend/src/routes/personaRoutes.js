const express = require('express');
const router = express.Router();
const personaController = require('../controllers/personaController');
const { verificarToken, verificarRol } = require('../middlewares/authMiddleware');

// Endpoint PÚBLICO para la búsqueda por cédula de la página web
router.get('/consulta/:cedula', personaController.consultaPublicaPorCedula);

// Endpoints protegidos para administración
router.get('/', verificarToken, personaController.getPersonas);
router.get('/:id', verificarToken, personaController.getPersonaById);
router.post('/', verificarToken, verificarRol(['ADMIN', 'SECRETARIO']), personaController.createPersona);
router.put('/:id', verificarToken, verificarRol(['ADMIN', 'SECRETARIO']), personaController.updatePersona);

module.exports = router;
