const whatsappService = require('../services/whatsappService');

async function getStatus(req, res, next) {
  try {
    const currentStatus = whatsappService.getStatus();
    if (currentStatus.status === 'DISCONNECTED') {
      whatsappService.initWhatsApp();
    }
    return res.json({ status: 'OK', data: whatsappService.getStatus() });
  } catch (error) {
    next(error);
  }
}

async function initSession(req, res, next) {
  try {
    whatsappService.initWhatsApp();
    return res.json({ status: 'OK', message: 'Inicializando servicio de WhatsApp.', data: whatsappService.getStatus() });
  } catch (error) {
    next(error);
  }
}

async function logoutSession(req, res, next) {
  try {
    const result = await whatsappService.logoutWhatsApp();
    return res.json(result);
  } catch (error) {
    next(error);
  }
}

async function notificarMinga(req, res, next) {
  try {
    const { eventoId } = req.body;
    if (!eventoId) {
      return res.status(400).json({ status: 'ERROR', message: 'Se requiere eventoId.' });
    }

    const resultado = await whatsappService.enviarConvocatoriaMinga(eventoId);
    return res.json(resultado);
  } catch (error) {
    return res.status(400).json({ status: 'ERROR', message: error.message });
  }
}

module.exports = {
  getStatus,
  initSession,
  logoutSession,
  notificarMinga
};
