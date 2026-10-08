const crypto = require('crypto');
const express = require('express');
const { ErrorServicio } = require('./sesion');

function tokenValido(recibido, esperado) {
  const a = Buffer.from(String(recibido));
  const b = Buffer.from(esperado);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * API interna del servicio. Solo la usa el backend, que se identifica con el token compartido.
 * @param {{ sesion: import('./sesion').SesionWhatsApp, token: string, log?: Console }} opciones
 */
function crearApp({ sesion, token, log = console }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '32kb' }));

  app.get('/salud', (req, res) => res.json({ status: 'OK' }));

  app.use((req, res, next) => {
    const cabecera = req.headers.authorization;
    const recibido = typeof cabecera === 'string' && cabecera.startsWith('Bearer ') ? cabecera.slice(7) : '';
    if (!tokenValido(recibido, token)) return res.status(401).json({ status: 'ERROR', message: 'No autorizado.' });
    next();
  });

  app.get('/estado', (req, res) => res.json({ status: 'OK', data: sesion.estado() }));
  app.post('/sesion/iniciar', (req, res) => res.json({ status: 'OK', data: sesion.iniciar() }));
  app.post('/sesion/cerrar', async (req, res) => res.json({ status: 'OK', data: await sesion.cerrarSesion() }));
  app.get('/grupos', async (req, res) => res.json({ status: 'OK', data: await sesion.listarGrupos() }));
  app.post('/grupos/:grupoId/mensajes', async (req, res) => {
    const data = await sesion.enviarAGrupo(req.params.grupoId, req.body?.texto);
    res.status(201).json({ status: 'OK', data });
  });

  app.use((req, res) => res.status(404).json({ status: 'ERROR', message: 'Ruta no encontrada.' }));

  app.use((err, req, res, _next) => {
    if (err instanceof ErrorServicio) return res.status(err.status).json({ status: 'ERROR', message: err.message });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ status: 'ERROR', message: 'JSON inválido.' });
    log.error('[WhatsApp] Error no controlado:', err);
    return res.status(500).json({ status: 'ERROR', message: 'Error interno del servicio de WhatsApp.' });
  });

  return app;
}

module.exports = { crearApp };
