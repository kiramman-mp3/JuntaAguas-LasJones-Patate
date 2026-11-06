const { resetDatabase, closeDatabase } = require('../helpers/testEnv');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const app = require('../../src/app');
const db = require('../../src/config/db');
const { conectarBase } = require('../../src/db/connection');
const { asegurarAdminInicial, restablecerPasswordAdmin } = require('../../src/db/adminInicial');

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

test('un administrador que perdió su contraseña la recupera con una temporal nueva y sus sesiones se cierran', async () => {
  const login = (password) => request(app).post('/api/auth/login').send({ cedula: datos.cedula, password });
  const [[{ id: cuentaId }]] = await db.query('SELECT c.id FROM cuentas c JOIN personas p ON p.id = c.persona_id WHERE p.cedula = ?', [datos.cedula]);

  // Con la cuenta bloqueada y una sesión abierta, la recuperación debe levantar ambas cosas.
  const clave = 'Clave-Original-7391';
  await db.query('UPDATE cuentas SET password_hash = ?, debe_cambiar_password = FALSE WHERE id = ?', [await require('../../src/shared/passwords').hashPassword(clave), cuentaId]);
  const abierta = await login(clave);
  assert.equal(abierta.status, 200);
  await db.query("INSERT INTO intentos_login (cuenta_id, ip, intentos, bloqueado_hasta) VALUES (?, '203.0.113.7', 0, UTC_TIMESTAMP() + INTERVAL 15 MINUTE)", [cuentaId]);

  const r = await restablecerPasswordAdmin(conexion, datos.cedula);
  assert.equal(r.cedula, datos.cedula);
  assert.equal(r.passwordTemporal.length, 12);

  assert.equal((await request(app).get('/api/auth/me').set({ Authorization: `Bearer ${abierta.body.token}` })).status, 401, 'la sesión anterior se cerró');
  assert.equal((await login(clave)).status, 401, 'la contraseña anterior ya no sirve');
  const nueva = await login(r.passwordTemporal);
  assert.equal(nueva.status, 200);
  assert.equal(nueva.body.user.debeCambiarPassword, true);
  const [bloqueos] = await db.query('SELECT 1 FROM intentos_login WHERE cuenta_id = ?', [cuentaId]);
  assert.equal(bloqueos.length, 0);
  const [[auditoria]] = await db.query("SELECT COUNT(*) AS n FROM auditoria WHERE entidad = 'cuentas' AND entidad_id = ? AND detalle LIKE '%restablecerPassword%'", [cuentaId]);
  assert.equal(auditoria.n, 1);
});

test('la recuperación solo sirve para cédulas válidas de administradores', async () => {
  await assert.rejects(restablecerPasswordAdmin(conexion, ''), /cédula del administrador/);
  await assert.rejects(restablecerPasswordAdmin(conexion, '1234567890'), /cédula del administrador/);
  const { crearUsuario, generarCedula } = require('../helpers/fixtures');
  await assert.rejects(restablecerPasswordAdmin(conexion, generarCedula(9876)), /No existe una cuenta de administrador/);

  // Una cuenta de USUARIO no se recupera por esta vía.
  const socio = await crearUsuario();
  await assert.rejects(restablecerPasswordAdmin(conexion, socio.cedula), /No existe una cuenta de administrador/);
});
