const { test } = require('node:test');
const assert = require('node:assert/strict');
const { SesionWhatsApp, ESTADOS } = require('../src/sesion');
const { ClienteFalso, logSilencioso } = require('./helpers/clienteFalso');

const GRUPO = '120363000000000001@g.us';
const esperar = () => new Promise((resolver) => setImmediate(resolver));
async function esperarHasta(condicion, intentos = 50) {
  for (let i = 0; i < intentos && !condicion(); i++) await esperar();
  assert.ok(condicion(), 'la condición no se cumplió a tiempo');
}

function crearSesion({ clientes = [], tiempoInicioMs } = {}) {
  const creados = [];
  const sesion = new SesionWhatsApp({
    crearCliente: () => {
      const cliente = clientes[creados.length] ?? new ClienteFalso();
      creados.push(cliente);
      return cliente;
    },
    generarQr: async (texto) => `data:image/png;base64,${texto}`,
    tiempoInicioMs,
    log: logSilencioso
  });
  return { sesion, creados };
}

async function sesionConectada(chats) {
  const cliente = new ClienteFalso({ chats });
  const { sesion } = crearSesion({ clientes: [cliente] });
  sesion.iniciar();
  cliente.emit('ready');
  return { sesion, cliente };
}

test('consultar el estado no inicia WhatsApp', () => {
  const { sesion, creados } = crearSesion();
  assert.deepEqual(sesion.estado(), { estado: ESTADOS.DESCONECTADO, conectado: false, mensaje: 'WhatsApp no está conectado.', qr: null });
  sesion.estado();
  assert.equal(creados.length, 0);
});

test('iniciar varias veces crea un solo navegador', () => {
  const { sesion, creados } = crearSesion();
  sesion.iniciar();
  sesion.iniciar();
  assert.equal(creados.length, 1);
  assert.equal(sesion.estado().estado, ESTADOS.INICIANDO);
});

test('muestra el QR y lo retira al conectarse', async () => {
  const { sesion, creados } = crearSesion();
  sesion.iniciar();
  creados[0].emit('qr', 'abc');
  await esperar();
  assert.equal(sesion.estado().estado, ESTADOS.ESPERANDO_QR);
  assert.equal(sesion.estado().qr, 'data:image/png;base64,abc');

  creados[0].emit('authenticated');
  creados[0].emit('ready');
  assert.deepEqual(
    { estado: sesion.estado().estado, conectado: sesion.estado().conectado, qr: sesion.estado().qr },
    { estado: ESTADOS.CONECTADO, conectado: true, qr: null }
  );
});

test('si el inicio falla libera el navegador y permite reintentar', async () => {
  const fallido = new ClienteFalso({ falloInicio: new Error('sin navegador') });
  const { sesion, creados } = crearSesion({ clientes: [fallido] });
  sesion.iniciar();
  await esperar();
  assert.equal(sesion.estado().estado, ESTADOS.DESCONECTADO);
  assert.match(sesion.estado().mensaje, /sin navegador/);
  assert.equal(fallido.destruido, true);

  sesion.iniciar();
  assert.equal(creados.length, 2);
});

test('reintenta el arranque si WhatsApp Web recarga la página mientras inicia', async () => {
  const transitorio = () => new ClienteFalso({ falloInicio: new Error('Execution context was destroyed, most likely because of a navigation.') });
  const { sesion, creados } = crearSesion({ clientes: [transitorio(), transitorio()] });
  sesion.iniciar();
  await esperarHasta(() => creados.length === 3);
  assert.equal(creados[0].destruido, true);
  assert.equal(creados[1].destruido, true);
  creados[2].emit('qr', 'abc');
  await esperar();
  assert.equal(sesion.estado().estado, ESTADOS.ESPERANDO_QR);
});

test('no reintenta más de tres veces ni ante errores que no son transitorios', async () => {
  const transitorio = () => new ClienteFalso({ falloInicio: new Error('Protocol error: Target closed') });
  const agotado = crearSesion({ clientes: [transitorio(), transitorio(), transitorio(), transitorio()] });
  agotado.sesion.iniciar();
  await esperarHasta(() => agotado.sesion.estado().estado === ESTADOS.DESCONECTADO);
  assert.equal(agotado.creados.length, 3);

  const definitivo = crearSesion({ clientes: [new ClienteFalso({ falloInicio: new Error('Failed to launch the browser process') })] });
  definitivo.sesion.iniciar();
  await esperarHasta(() => definitivo.sesion.estado().estado === ESTADOS.DESCONECTADO);
  assert.equal(definitivo.creados.length, 1);
});

test('detener durante un reintento no arranca otro navegador', async () => {
  const transitorio = new ClienteFalso({ falloInicio: new Error('Execution context was destroyed.') });
  const { sesion, creados } = crearSesion({ clientes: [transitorio] });
  sesion.iniciar();
  await sesion.detener();
  await esperar();
  await esperar();
  assert.equal(creados.length, 1);
  assert.equal(sesion.estado().estado, ESTADOS.DESCONECTADO);
});

test('si no termina de conectarse a tiempo se descarta', async () => {
  const { sesion, creados } = crearSesion({ tiempoInicioMs: 5 });
  sesion.iniciar();
  await new Promise((resolver) => setTimeout(resolver, 20));
  assert.equal(sesion.estado().estado, ESTADOS.DESCONECTADO);
  assert.equal(creados[0].destruido, true);
});

test('una desconexión deja el servicio desconectado y los eventos tardíos se ignoran', async () => {
  const { sesion, cliente } = await sesionConectada([]);
  cliente.emit('disconnected', 'LOGOUT');
  assert.equal(sesion.estado().estado, ESTADOS.DESCONECTADO);
  cliente.emit('ready');
  assert.equal(sesion.estado().estado, ESTADOS.DESCONECTADO);
});

test('lista solo los grupos, ordenados por nombre', async () => {
  const { sesion } = await sesionConectada([
    { id: '120363000000000002@g.us', nombre: 'Zanjeros' },
    { id: '593990000000@c.us', nombre: 'Persona', esGrupo: false },
    { id: GRUPO, nombre: 'Comuneros La Jones', participantes: 120 }
  ]);
  assert.deepEqual(await sesion.listarGrupos(), [
    { id: GRUPO, nombre: 'Comuneros La Jones', participantes: 120 },
    { id: '120363000000000002@g.us', nombre: 'Zanjeros', participantes: 3 }
  ]);
});

test('sin conexión no lista grupos ni envía mensajes', async () => {
  const { sesion } = crearSesion();
  await assert.rejects(sesion.listarGrupos(), { status: 409 });
  await assert.rejects(sesion.enviarAGrupo(GRUPO, 'Hola'), { status: 409 });
});

test('envía el mensaje al grupo y valida los datos', async () => {
  const { sesion, cliente } = await sesionConectada([
    { id: GRUPO, nombre: 'Comuneros' },
    { id: '593990000000@c.us', nombre: 'Persona', esGrupo: false }
  ]);
  assert.deepEqual(await sesion.enviarAGrupo(GRUPO, 'Convocatoria'), { mensajeId: 'msg-1' });
  assert.deepEqual(cliente.enviados, [{ id: GRUPO, texto: 'Convocatoria' }]);

  await assert.rejects(sesion.enviarAGrupo('593990000000@c.us', 'Hola'), { status: 400 });
  await assert.rejects(sesion.enviarAGrupo(GRUPO, '   '), { status: 400 });
  await assert.rejects(sesion.enviarAGrupo(GRUPO, 'x'.repeat(4001)), { status: 400 });
  await assert.rejects(sesion.enviarAGrupo('120363999999999999@g.us', 'Hola'), { status: 404 });
});

test('un rechazo de WhatsApp al enviar se informa como 502', async () => {
  const { sesion } = await sesionConectada([{ id: GRUPO, nombre: 'Solo admins', falloEnvio: new Error('not admin') }]);
  await assert.rejects(sesion.enviarAGrupo(GRUPO, 'Hola'), { status: 502, message: /not admin/ });
});

test('si WhatsApp Web no puede leer los grupos responde 502 con un mensaje claro', async () => {
  const cliente = new ClienteFalso({ falloListar: new Error('r') });
  const { sesion } = crearSesion({ clientes: [cliente] });
  sesion.iniciar();
  cliente.emit('ready');
  await assert.rejects(sesion.listarGrupos(), { status: 502, message: /todavía no cargó los grupos/ });
  await assert.rejects(sesion.enviarAGrupo(GRUPO, 'Hola'), { status: 502 });
});

test('un envío confirmado sin el objeto del mensaje cuenta como enviado (no se duplica al reintentar)', async () => {
  const cliente = new ClienteFalso({ chats: [{ id: GRUPO, nombre: 'Comuneros' }], sinConfirmacion: true });
  const { sesion } = crearSesion({ clientes: [cliente] });
  sesion.iniciar();
  cliente.emit('ready');
  assert.deepEqual(await sesion.enviarAGrupo(GRUPO, 'Hola'), { mensajeId: null });
});

test('cerrar sesión desvincula el teléfono y libera el navegador', async () => {
  const { sesion, cliente } = await sesionConectada([]);
  const estado = await sesion.cerrarSesion();
  assert.equal(estado.estado, ESTADOS.DESCONECTADO);
  assert.equal(cliente.cerroSesion, true);
  assert.equal(cliente.destruido, true);
});

test('detener libera el navegador sin desvincular el teléfono', async () => {
  const { sesion, cliente } = await sesionConectada([]);
  await sesion.detener();
  assert.equal(cliente.cerroSesion, false);
  assert.equal(cliente.destruido, true);
});
