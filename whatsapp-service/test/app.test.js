const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { crearApp } = require('../src/app');
const { SesionWhatsApp } = require('../src/sesion');
const { ClienteFalso, logSilencioso } = require('./helpers/clienteFalso');

const TOKEN = 'token-de-pruebas-del-servicio-0123456789';
const GRUPO = '120363000000000001@g.us';

let servidor;
let base;
let cliente;
let sesion;

before(async () => {
  cliente = new ClienteFalso({ chats: [{ id: GRUPO, nombre: 'Comuneros' }] });
  sesion = new SesionWhatsApp({ crearCliente: () => cliente, generarQr: async (t) => t, log: logSilencioso });
  servidor = crearApp({ sesion, token: TOKEN, log: logSilencioso }).listen(0, '127.0.0.1');
  await new Promise((resolver) => servidor.once('listening', resolver));
  base = `http://127.0.0.1:${servidor.address().port}`;
});

after(() => new Promise((resolver) => servidor.close(resolver)));

function pedir(ruta, { metodo = 'GET', token = TOKEN, cuerpo } = {}) {
  return fetch(`${base}${ruta}`, {
    method: metodo,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(cuerpo ? { 'Content-Type': 'application/json' } : {}) },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined
  });
}

test('rechaza peticiones sin el token compartido', async () => {
  assert.equal((await pedir('/estado', { token: null })).status, 401);
  assert.equal((await pedir('/estado', { token: 'otro-token' })).status, 401);
  assert.equal((await pedir('/salud', { token: null })).status, 200);
});

test('flujo completo: estado, conexión, grupos y envío', async () => {
  let r = await pedir('/estado');
  assert.equal(r.status, 200);
  assert.equal((await r.json()).data.estado, 'DESCONECTADO');

  r = await pedir('/grupos');
  assert.equal(r.status, 409);

  r = await pedir('/sesion/iniciar', { metodo: 'POST' });
  assert.equal((await r.json()).data.estado, 'INICIANDO');
  cliente.emit('ready');

  r = await pedir('/grupos');
  assert.deepEqual((await r.json()).data, [{ id: GRUPO, nombre: 'Comuneros', participantes: 3 }]);

  r = await pedir(`/grupos/${encodeURIComponent(GRUPO)}/mensajes`, { metodo: 'POST', cuerpo: { texto: 'Convocatoria' } });
  assert.equal(r.status, 201);
  assert.deepEqual(cliente.enviados, [{ id: GRUPO, texto: 'Convocatoria' }]);

  r = await pedir(`/grupos/${encodeURIComponent(GRUPO)}/mensajes`, { metodo: 'POST', cuerpo: {} });
  assert.equal(r.status, 400);

  r = await pedir('/sesion/cerrar', { metodo: 'POST' });
  assert.equal((await r.json()).data.estado, 'DESCONECTADO');
});

test('responde 404 en rutas desconocidas', async () => {
  assert.equal((await pedir('/no-existe')).status, 404);
});
