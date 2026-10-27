const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');

const { crearLogger } = require('../../src/shared/logger');
const requestLogger = require('../../src/middlewares/requestLogger');

function captura() {
  const lineas = [];
  return { lineas, write: (texto) => lineas.push(texto) };
}

test('en producción cada evento es una línea JSON con hora, nivel y campos', () => {
  const salida = captura();
  const log = crearLogger({ nivel: 'info', json: true, salida, ahora: () => new Date('2026-10-26T12:00:00Z') });
  log.info('pago registrado', { pagoId: 7 });

  assert.equal(salida.lineas.length, 1);
  assert.deepEqual(JSON.parse(salida.lineas[0]), { hora: '2026-10-26T12:00:00.000Z', nivel: 'info', mensaje: 'pago registrado', pagoId: 7 });
});

test('los errores van a stderr y se serializan con su mensaje y traza', () => {
  const salida = captura();
  const salidaError = captura();
  const log = crearLogger({ json: true, salida, salidaError });
  log.error('falló', { err: Object.assign(new Error('conexión perdida'), { code: 'ECONNRESET' }) });

  assert.equal(salida.lineas.length, 0);
  const registro = JSON.parse(salidaError.lineas[0]);
  assert.equal(registro.err.mensaje, 'conexión perdida');
  assert.equal(registro.err.codigo, 'ECONNRESET');
  assert.match(registro.err.stack, /conexión perdida/);
});

test('el nivel mínimo descarta los eventos menos graves y silent lo descarta todo', () => {
  const salida = captura();
  const salidaError = captura();
  const log = crearLogger({ nivel: 'warn', json: true, salida, salidaError });
  log.debug('d');
  log.info('i');
  log.warn('w');
  log.error('e');
  assert.equal(salida.lineas.length + salidaError.lineas.length, 2);

  const callado = crearLogger({ nivel: 'silent', json: true, salida, salidaError });
  callado.error('e');
  assert.equal(salidaError.lineas.length, 1);
});

test('fuera de producción escribe texto legible', () => {
  const salida = captura();
  crearLogger({ nivel: 'info', salida }).info('listo', { puerto: 3000 });
  assert.equal(salida.lineas[0], '[info] listo {"puerto":3000}\n');
});

function simular({ cabeceras = {}, estado = 200, url = '/api/pagos?cedula=1800000000', user } = {}) {
  const eventos = [];
  const logger = Object.fromEntries(['debug', 'info', 'warn', 'error'].map((n) => [n, (mensaje, campos) => eventos.push({ nivel: n, mensaje, campos })]));
  const req = { headers: cabeceras, method: 'GET', originalUrl: url, ip: '10.0.0.5', user };
  const res = Object.assign(new EventEmitter(), { statusCode: estado, cabeceras: {}, setHeader(k, v) { this.cabeceras[k] = v; } });
  requestLogger(logger)(req, res, () => {});
  res.emit('finish');
  return { eventos, req, res };
}

test('cada petición recibe un X-Request-Id y se registra sin query string', () => {
  const { eventos, req, res } = simular({ user: { cuentaId: 4 } });

  assert.match(req.id, /^[0-9a-f-]{36}$/);
  assert.equal(res.cabeceras['X-Request-Id'], req.id);
  assert.equal(eventos.length, 1);
  assert.equal(eventos[0].nivel, 'info');
  assert.equal(eventos[0].campos.ruta, '/api/pagos');
  assert.equal(eventos[0].campos.cuentaId, 4);
  assert.equal(JSON.stringify(eventos[0].campos).includes('1800000000'), false);
});

test('conserva un X-Request-Id válido del proxy y descarta uno sospechoso', () => {
  assert.equal(simular({ cabeceras: { 'x-request-id': 'abc12345-trace' } }).req.id, 'abc12345-trace');
  assert.notEqual(simular({ cabeceras: { 'x-request-id': 'a b\nc' } }).req.id, 'a b\nc');
});

test('4xx se registra como warn, 5xx como error y la salud como debug', () => {
  assert.equal(simular({ estado: 403 }).eventos[0].nivel, 'warn');
  assert.equal(simular({ estado: 500 }).eventos[0].nivel, 'error');
  assert.equal(simular({ url: '/api/health' }).eventos[0].nivel, 'debug');
});
