const { resetDatabase, closeDatabase } = require('../helpers/testEnv');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const app = require('../../src/app');
const db = require('../../src/config/db');
const { crearUsuario, auth, generarCedula } = require('../helpers/fixtures');

before(resetDatabase);
after(closeDatabase);

const login = (cedula, password) => request(app).post('/api/auth/login').send({ cedula, password });

test('credenciales inválidas devuelven siempre el mismo mensaje', async () => {
  const u = await crearUsuario();
  const malPassword = await login(u.cedula, 'incorrecta1');
  const cedulaInexistente = await login(generarCedula(9999), 'incorrecta1');
  assert.equal(malPassword.status, 401);
  assert.equal(cedulaInexistente.status, 401);
  assert.equal(malPassword.body.message, cedulaInexistente.body.message);
});

test('la cuenta se bloquea tras 5 intentos fallidos aunque luego use la contraseña correcta', async () => {
  const u = await crearUsuario();
  for (let i = 0; i < 5; i++) await login(u.cedula, 'incorrecta1');
  const res = await login(u.cedula, u.password);
  assert.equal(res.status, 401);
  assert.match(res.body.message, /Credenciales incorrectas/);
});

test('una cuenta inactiva no puede iniciar sesión ni usar tokens previos', async () => {
  const u = await crearUsuario();
  await db.query("UPDATE cuentas SET estado = 'INACTIVA' WHERE id = ?", [u.cuentaId]);
  assert.equal((await login(u.cedula, u.password)).status, 401);
  assert.equal((await request(app).get('/api/auth/me').set(auth(u))).status, 401);
});

test('el token por query string ya no se acepta', async () => {
  const u = await crearUsuario();
  const res = await request(app).get(`/api/auth/me?token=${u.token}`);
  assert.equal(res.status, 401);
});

test('con contraseña temporal solo se permite cambiarla; luego la sesión es completa', async () => {
  const u = await crearUsuario({ debeCambiar: true, password: 'Temporal99' });
  const inicio = await login(u.cedula, 'Temporal99');
  assert.equal(inicio.status, 200);
  assert.equal(inicio.body.user.debeCambiarPassword, true);
  const temporal = { Authorization: `Bearer ${inicio.body.token}` };

  const bloqueado = await request(app).get('/api/auth/me').set(temporal);
  assert.equal(bloqueado.status, 403);
  assert.equal(bloqueado.body.codigo, 'CAMBIO_PASSWORD_REQUERIDO');

  const debil = await request(app).post('/api/auth/change-password').set(temporal)
    .send({ actualPassword: 'Temporal99', nuevaPassword: 'corta' });
  assert.equal(debil.status, 400);

  const conCedula = await request(app).post('/api/auth/change-password').set(temporal)
    .send({ actualPassword: 'Temporal99', nuevaPassword: `x${u.cedula}` });
  assert.equal(conCedula.status, 400);

  const cambio = await request(app).post('/api/auth/change-password').set(temporal)
    .send({ actualPassword: 'Temporal99', nuevaPassword: 'NuevaClave2026' });
  assert.equal(cambio.status, 200);
  assert.equal(cambio.body.user.debeCambiarPassword, false);

  const me = await request(app).get('/api/auth/me').set({ Authorization: `Bearer ${cambio.body.token}` });
  assert.equal(me.status, 200);

  // El token temporal anterior quedó revocado por el cambio de contraseña.
  assert.equal((await request(app).post('/api/auth/change-password').set(temporal)
    .send({ actualPassword: 'NuevaClave2026', nuevaPassword: 'OtraClave2027' })).status, 401);
});

test('el rol se toma de la base: un cambio de rol aplica sin volver a iniciar sesión', async () => {
  const u = await crearUsuario({ rol: 'ADMIN' });
  assert.equal((await request(app).get('/api/personas').set(auth(u))).status, 200);
  await db.query("UPDATE cuentas SET rol_id = (SELECT id FROM roles WHERE codigo = 'USUARIO') WHERE id = ?", [u.cuentaId]);
  assert.equal((await request(app).get('/api/personas').set(auth(u))).status, 403);
});
