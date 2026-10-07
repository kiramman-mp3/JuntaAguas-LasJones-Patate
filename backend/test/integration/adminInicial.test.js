const { resetDatabase, closeDatabase } = require('../helpers/testEnv');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const app = require('../../src/app');
const db = require('../../src/config/db');
const { conectarBase } = require('../../src/db/connection');
const { asegurarAdminInicial } = require('../../src/db/adminInicial');

const datos = { cedula: '1710034065', nombres: 'Rosa', apellidos: 'Caiza' };
let conexion;

before(async () => {
  await resetDatabase();
  conexion = await conectarBase(process.env.DB_NAME);
});
after(async () => {
  await conexion.end();
  await closeDatabase();
});

test('en una base limpia exige datos válidos para el primer administrador', async () => {
  await assert.rejects(asegurarAdminInicial(conexion, { ...datos, cedula: '1234567890' }), /ADMIN_CEDULA/);
  await assert.rejects(asegurarAdminInicial(conexion, { ...datos, nombres: '' }), /ADMIN_NOMBRES/);
  const [cuentas] = await db.query('SELECT id FROM cuentas');
  assert.equal(cuentas.length, 0, 'un intento fallido no deja datos a medias');
});

test('crea un único administrador que debe cambiar su contraseña temporal al ingresar', async () => {
  const admin = await asegurarAdminInicial(conexion, datos);
  assert.equal(admin.creado, true);

  const login = await request(app).post('/api/auth/login').send({ cedula: datos.cedula, password: admin.passwordTemporal });
  assert.equal(login.status, 200, JSON.stringify(login.body));
  const [[cuenta]] = await db.query(
    "SELECT c.debe_cambiar_password, r.codigo FROM cuentas c JOIN roles r ON r.id = c.rol_id JOIN personas p ON p.id = c.persona_id WHERE p.cedula = ?",
    [datos.cedula]
  );
  assert.equal(cuenta.codigo, 'ADMIN');
  assert.equal(Boolean(cuenta.debe_cambiar_password), true);

  // Repetir el despliegue no crea otro administrador ni cambia la contraseña.
  assert.deepEqual(await asegurarAdminInicial(conexion, { ...datos, cedula: '0102030405' }), { creado: false });
  const [admins] = await db.query("SELECT c.id FROM cuentas c JOIN roles r ON r.id = c.rol_id WHERE r.codigo = 'ADMIN'");
  assert.equal(admins.length, 1);
});
