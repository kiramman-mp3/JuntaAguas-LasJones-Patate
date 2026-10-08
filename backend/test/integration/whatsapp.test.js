const { resetDatabase, closeDatabase } = require('../helpers/testEnv');
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');

const app = require('../../src/app');
const db = require('../../src/config/db');
const env = require('../../src/config/env');
const { hoy } = require('../../src/shared/dates');
const { crearUsuario, auth } = require('../helpers/fixtures');

const GRUPO = { id: '120363000000000001@g.us', nombre: 'Comuneros La Jones', participantes: 120 };

/** Servicio de WhatsApp simulado: responde como whatsapp-service y registra los mensajes. */
const servicio = { estado: 'CONECTADO', grupos: [GRUPO], enviados: [], falloEnvio: null };
let servidor;
let admin;
let comunero;

function iniciarServicioFalso() {
  const fake = express();
  const token = env.WHATSAPP_SERVICE_TOKEN;
  fake.use(express.json());
  fake.use((req, res, next) => {
    if (req.headers.authorization !== `Bearer ${token}`) return res.status(401).json({ status: 'ERROR', message: 'No autorizado.' });
    next();
  });
  const estado = () => ({ estado: servicio.estado, conectado: servicio.estado === 'CONECTADO', mensaje: servicio.estado, qr: null });
  fake.get('/estado', (req, res) => res.json({ status: 'OK', data: estado() }));
  fake.post('/sesion/iniciar', (req, res) => res.json({ status: 'OK', data: estado() }));
  fake.post('/sesion/cerrar', (req, res) => {
    servicio.estado = 'DESCONECTADO';
    res.json({ status: 'OK', data: estado() });
  });
  fake.get('/grupos', (req, res) => res.json({ status: 'OK', data: servicio.grupos }));
  fake.post('/grupos/:grupoId/mensajes', (req, res) => {
    if (servicio.falloEnvio) return res.status(502).json({ status: 'ERROR', message: servicio.falloEnvio });
    servicio.enviados.push({ grupoId: req.params.grupoId, texto: req.body.texto });
    res.status(201).json({ status: 'OK', data: { mensajeId: 'msg' } });
  });
  return new Promise((resolver) => {
    servidor = fake.listen(0, '127.0.0.1', () => resolver(`http://127.0.0.1:${servidor.address().port}`));
  });
}

function enDias(dias) {
  const d = new Date(`${hoy()}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

async function crearEvento({ tipo = 'MINGA', estado = 'PROGRAMADO', fecha = enDias(5), multa = 15 } = {}) {
  const [r] = await db.query(
    `INSERT INTO eventos (tipo, titulo, descripcion, fecha, hora_inicio, hora_fin, lugar, estado, genera_multa_ausencia, valor_multa, created_by_cuenta_id)
     VALUES (?, ?, NULL, ?, '07:30', '12:00', 'Bocatoma', ?, ?, ?, ?)`,
    [tipo, `${tipo === 'MINGA' ? 'Limpieza del canal' : 'Asamblea ordinaria'} ${fecha}`, fecha, estado, Boolean(multa), multa || null, admin.cuentaId]
  );
  return r.insertId;
}

const convocar = (eventoId, extra = {}) =>
  request(app).post('/api/whatsapp/convocatorias').set(auth(admin)).send({ eventoId, ...extra });

before(async () => {
  await resetDatabase();
  admin = await crearUsuario({ rol: 'ADMIN' });
  comunero = await crearUsuario();
});
after(async () => {
  await new Promise((resolver) => (servidor ? servidor.close(resolver) : resolver()));
  await closeDatabase();
});
beforeEach(() => {
  servicio.estado = 'CONECTADO';
  servicio.enviados = [];
  servicio.falloEnvio = null;
});

test('con el servicio apagado el estado lo informa sin fallar', async () => {
  env.WHATSAPP_SERVICE_URL = 'http://127.0.0.1:9';
  const r = await request(app).get('/api/whatsapp/estado').set(auth(admin));
  assert.equal(r.status, 200);
  assert.equal(r.body.data.estado, 'NO_DISPONIBLE');
  assert.equal(r.body.data.grupo, null);

  const grupos = await request(app).get('/api/whatsapp/grupos').set(auth(admin));
  assert.equal(grupos.status, 503);

  env.WHATSAPP_SERVICE_URL = await iniciarServicioFalso();
});

test('solo la directiva usa WhatsApp', async () => {
  const r = await request(app).get('/api/whatsapp/estado').set(auth(comunero));
  assert.equal(r.status, 403);
});

test('sin grupo elegido no se puede convocar', async () => {
  const eventoId = await crearEvento();
  const r = await convocar(eventoId);
  assert.equal(r.status, 409);
  assert.equal(r.body.codigo, 'GRUPO_NO_CONFIGURADO');
  assert.equal(servicio.enviados.length, 0);
});

test('elige el grupo entre los de la cuenta vinculada', async () => {
  let r = await request(app).put('/api/whatsapp/grupo').set(auth(admin)).send({ grupoId: '593990000000@c.us' });
  assert.equal(r.status, 400);

  r = await request(app).put('/api/whatsapp/grupo').set(auth(admin)).send({ grupoId: '120363999999999999@g.us' });
  assert.equal(r.status, 404);

  r = await request(app).put('/api/whatsapp/grupo').set(auth(admin)).send({ grupoId: GRUPO.id });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.data, { id: GRUPO.id, nombre: GRUPO.nombre });

  r = await request(app).get('/api/whatsapp/estado').set(auth(admin));
  assert.equal(r.body.data.estado, 'CONECTADO');
  assert.deepEqual(r.body.data.grupo, { id: GRUPO.id, nombre: GRUPO.nombre });
});

test('publica la convocatoria de una minga en el grupo y la marca convocada', async () => {
  const fecha = enDias(5);
  const eventoId = await crearEvento({ fecha });
  const r = await convocar(eventoId);
  assert.equal(r.status, 201);
  assert.equal(r.body.data.estado, 'CONVOCADO');
  assert.equal(r.body.data.reenvio, false);

  assert.equal(servicio.enviados.length, 1);
  const { grupoId, texto } = servicio.enviados[0];
  assert.equal(grupoId, GRUPO.id);
  assert.match(texto, /CONVOCATORIA A MINGA COMUNITARIA/);
  assert.match(texto, /Limpieza del canal/);
  assert.match(texto, /07:30 a 12:00/);
  assert.match(texto, /multa de \$15\.00/);
  assert.ok(texto.includes(require('../../src/shared/dates').fechaLarga(fecha)));

  const [[evento]] = await db.query('SELECT estado FROM eventos WHERE id = ?', [eventoId]);
  assert.equal(evento.estado, 'CONVOCADO');
  const [envios] = await db.query('SELECT persona_id, destino, destino_nombre, estado, enviado_por_cuenta_id FROM envios_convocatoria WHERE evento_id = ?', [eventoId]);
  assert.deepEqual(envios, [{ persona_id: null, destino: GRUPO.id, destino_nombre: GRUPO.nombre, estado: 'ENVIADO', enviado_por_cuenta_id: admin.cuentaId }]);
  const [auditoria] = await db.query("SELECT 1 FROM auditoria WHERE accion = 'CONVOCAR' AND entidad_id = ?", [eventoId]);
  assert.equal(auditoria.length, 1);
});

test('no reenvía una convocatoria ya publicada salvo que se pida', async () => {
  const eventoId = await crearEvento();
  assert.equal((await convocar(eventoId)).status, 201);

  const repetida = await convocar(eventoId);
  assert.equal(repetida.status, 409);
  assert.equal(repetida.body.codigo, 'CONVOCATORIA_YA_ENVIADA');
  assert.ok(repetida.body.enviadaEn);

  const reenvio = await convocar(eventoId, { reenviar: true });
  assert.equal(reenvio.status, 201);
  assert.equal(reenvio.body.data.reenvio, true);
  assert.equal(servicio.enviados.length, 2);
});

test('la convocatoria de una asamblea incluye el orden del día', async () => {
  const eventoId = await crearEvento({ tipo: 'ASAMBLEA', estado: 'BORRADOR', multa: 0 });
  await db.query(
    'INSERT INTO puntos_asamblea (evento_id, orden, punto_tratar, titulo_acta) VALUES (?, 1, ?, ?), (?, 2, ?, ?)',
    [eventoId, 'Informe de tesorería', 'Informe de tesorería', eventoId, 'Elección de directiva', 'Elección de directiva']
  );
  const r = await convocar(eventoId);
  assert.equal(r.status, 201);
  const { texto } = servicio.enviados[0];
  assert.match(texto, /CONVOCATORIA A ASAMBLEA GENERAL/);
  assert.match(texto, /1\. Informe de tesorería\n2\. Elección de directiva/);
  assert.match(texto, /Se solicita su puntual asistencia/);
});

test('rechaza eventos cancelados, realizados o con fecha pasada', async () => {
  for (const datos of [{ estado: 'CANCELADO' }, { estado: 'REALIZADO' }, { fecha: enDias(-1) }]) {
    const r = await convocar(await crearEvento(datos));
    assert.equal(r.status, 409, JSON.stringify(datos));
  }
  assert.equal((await convocar(999999)).status, 404);
  assert.equal(servicio.enviados.length, 0);
});

test('un fallo de WhatsApp se informa y queda registrado sin convocar el evento', async () => {
  servicio.falloEnvio = 'Solo los administradores del grupo pueden enviar mensajes.';
  const eventoId = await crearEvento();
  const r = await convocar(eventoId);
  assert.equal(r.status, 502);
  assert.match(r.body.message, /administradores del grupo/);

  const [[evento]] = await db.query('SELECT estado FROM eventos WHERE id = ?', [eventoId]);
  assert.equal(evento.estado, 'PROGRAMADO');
  const [[envio]] = await db.query('SELECT estado, detalle_error FROM envios_convocatoria WHERE evento_id = ?', [eventoId]);
  assert.equal(envio.estado, 'ERROR');
  assert.match(envio.detalle_error, /administradores/);
});

test('un token distinto en el servicio se informa como error de configuración', async () => {
  const original = env.WHATSAPP_SERVICE_TOKEN;
  env.WHATSAPP_SERVICE_TOKEN = 'otro-token-que-el-servicio-no-reconoce-0000';
  try {
    const r = await request(app).get('/api/whatsapp/grupos').set(auth(admin));
    assert.equal(r.status, 503);
    assert.match(r.body.message, /WHATSAPP_SERVICE_TOKEN/);
  } finally {
    env.WHATSAPP_SERVICE_TOKEN = original;
  }
});

test('cerrar la sesión de WhatsApp queda en la auditoría', async () => {
  const r = await request(app).post('/api/whatsapp/sesion/cerrar').set(auth(admin));
  assert.equal(r.status, 200);
  assert.equal(r.body.data.estado, 'DESCONECTADO');
  const [auditoria] = await db.query("SELECT 1 FROM auditoria WHERE entidad = 'whatsapp'");
  assert.equal(auditoria.length, 1);
});
