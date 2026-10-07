const express = require('express');
const whatsappController = require('../controllers/whatsappController');
const { soloAdmin } = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(...soloAdmin);
router.get('/status', whatsappController.getStatus);
router.post('/init', whatsappController.initSession);
router.post('/logout', whatsappController.logoutSession);
router.post('/notificar-minga', whatsappController.notificarMinga);

module.exports = router;
