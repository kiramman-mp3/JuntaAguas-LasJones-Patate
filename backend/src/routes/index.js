const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const personaRoutes = require('./personaRoutes');
const loteRoutes = require('./loteRoutes');
const turnoRoutes = require('./turnoRoutes');
const eventoRoutes = require('./eventoRoutes');
const financieroRoutes = require('./financieroRoutes');
const inventarioRoutes = require('./inventarioRoutes');
const planificacionRoutes = require('./planificacionRoutes');
const auditoriaRoutes = require('./auditoriaRoutes');

// Montaje de rutas funcionales API v1
router.use('/auth', authRoutes);
router.use('/personas', personaRoutes);
router.use('/lotes', loteRoutes);
router.use('/turnos', turnoRoutes);
router.use('/eventos', eventoRoutes);
router.use('/financiero', financieroRoutes);
router.use('/inventario', inventarioRoutes);
router.use('/planes', planificacionRoutes);
router.use('/auditoria', auditoriaRoutes);

module.exports = router;
