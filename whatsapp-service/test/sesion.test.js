const { test } = require('node:test');
const assert = require('node:assert/strict');
const { SesionWhatsApp, ESTADOS } = require('../src/sesion');
const { ClienteFalso, logSilencioso } = require('./helpers/clienteFalso');

const GRUPO = '120363000000000001@g.us';
const esperar = () => new Promise((resolver) => setImmediate(resolver));

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
