const { resetDatabase, closeDatabase } = require('../helpers/testEnv');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const app = require('../../src/app');
const db = require('../../src/config/db');
const { crearUsuario, auth, crearObligacion, crearSector, crearLote } = require('../helpers/fixtures');

let admin, comunero, vecino;

before(async () => {
  await resetDatabase();
  admin = await crearUsuario({ rol: 'ADMIN' });
  comunero = await crearUsuario({ rol: 'USUARIO' });
  vecino = await crearUsuario({ rol: 'USUARIO' });

  const sector = await crearSector('La Jones Alta');
  const loteComunero = await crearLote({ sectorId: sector, personaId: comunero.personaId, codigo: 'LJA-001' });
  await crearLote({ sectorId: sector, personaId: vecino.personaId, codigo: 'LJA-002' });
  await db.query(
    "INSERT INTO turnos_riego (persona_id, lote_id, dia_semana, hora_inicio, hora_fin) VALUES (?, ?, 1, '06:00', '07:00')",
    [comunero.personaId, loteComunero]
  );
  await crearObligacion({ personaId: comunero.personaId, mes: 1 });
  await crearObligacion({ personaId: vecino.personaId, mes: 1 });
});
after(closeDatabase);

test('los endpoints con datos personales exigen autenticación', async () => {
  for (const ruta of ['/api/lotes', '/api/turnos', '/api/eventos', '/api/eventos/1', '/api/eventos/1/pdf-asistencia',
    '/api/eventos/1/documentos', '/api/inventario', '/api/planes', '/api/personas', '/api/financiero/conceptos']) {
    const res = await request(app).get(ruta);
    assert.equal(res.status, 401, `${ruta} debería exigir autenticación`);
  }
});

test('los endpoints públicos no exponen cédulas', async () => {
  for (const ruta of ['/api/eventos/publicos', '/api/lotes/sectores', '/api/personas/stats']) {
    const res = await request(app).get(ruta);
    assert.equal(res.status, 200, ruta);
    assert.ok(!JSON.stringify(res.body).includes(comunero.cedula), `${ruta} expone una cédula`);
  }
});

test('un comunero no accede a las funciones de administración', async () => {
  const prohibidas = ['/api/personas', `/api/personas/${vecino.personaId}`, `/api/personas/consulta/${vecino.cedula}`,
    '/api/financiero/balance', '/api/financiero/egresos', `/api/financiero/obligaciones/multas?cedula=${vecino.cedula}`,
    '/api/eventos', '/api/auditoria', '/api/inventario', '/api/planes', '/api/whatsapp/status'];
  for (const ruta of prohibidas) {
    const res = await request(app).get(ruta).set(auth(comunero));
    assert.equal(res.status, 403, `${ruta} debería prohibirse a un comunero`);
  }
  assert.equal((await request(app).post('/api/eventos').set(auth(comunero)).send({})).status, 403);
  assert.equal((await request(app).post('/api/financiero/pagos').set(auth(comunero)).send({})).status, 403);
});

test('un comunero ve solo sus propios datos aunque pida los de otro', async () => {
  assert.equal((await request(app).get(`/api/personas/${comunero.personaId}`).set(auth(comunero))).status, 200);
  assert.equal((await request(app).get(`/api/personas/consulta/${comunero.cedula}`).set(auth(comunero))).status, 200);

  const obligaciones = await request(app).get(`/api/financiero/obligaciones?persona_id=${vecino.personaId}`).set(auth(comunero));
  assert.equal(obligaciones.status, 200);
  assert.ok(obligaciones.body.data.length > 0);
  assert.ok(obligaciones.body.data.every((o) => o.persona_id === comunero.personaId));

  const lotes = await request(app).get('/api/lotes').set(auth(comunero));
  assert.deepEqual(lotes.body.data.map((l) => l.codigo), ['LJA-001']);

  const turnos = await request(app).get(`/api/turnos?persona_id=${vecino.personaId}`).set(auth(comunero));
  assert.ok(turnos.body.data.length > 0);
  assert.ok(turnos.body.data.every((t) => t.persona_id === comunero.personaId));

  const pagos = await request(app).get(`/api/financiero/pagos?persona_id=${vecino.personaId}`).set(auth(comunero));
  assert.equal(pagos.status, 200);
  assert.ok(pagos.body.data.every((p) => p.persona_id === comunero.personaId));
});

test('el administrador accede a todas las áreas', async () => {
  for (const ruta of ['/api/personas', '/api/financiero/balance', '/api/eventos', '/api/auditoria', '/api/inventario', '/api/planes']) {
    assert.equal((await request(app).get(ruta).set(auth(admin))).status, 200, ruta);
  }
});

test('al crear una cuenta se entrega una contraseña temporal aleatoria que obliga a cambiarla', async () => {
  const res = await request(app).post('/api/personas').set(auth(admin)).send({
    cedula: '0102030400', nombres: 'Rosa', apellidos: 'Quispe', celular: '0991234567', crearCuenta: true
  });
  assert.equal(res.status, 201);
  assert.match(res.body.passwordTemporal, /^[A-Za-z2-9]{10}$/);
  assert.notEqual(res.body.passwordTemporal, '0102030400');

  const login = await request(app).post('/api/auth/login').send({ cedula: '0102030400', password: res.body.passwordTemporal });
  assert.equal(login.body.user.debeCambiarPassword, true);
  assert.equal((await request(app).get('/api/auth/me').set({ Authorization: `Bearer ${login.body.token}` })).status, 403);
});

test('solo existen los roles ADMIN y USUARIO al crear cuentas', async () => {
  const res = await request(app).post('/api/personas').set(auth(admin)).send({
    cedula: '1712345675', nombres: 'Otro', apellidos: 'Rol', crearCuenta: true, rol: 'SECRETARIO'
  });
  assert.equal(res.status, 400);
});

test('rechaza cédulas inválidas y datos de contacto mal formados', async () => {
  const cedula = await request(app).post('/api/personas').set(auth(admin)).send({ cedula: '1234567890', nombres: 'A', apellidos: 'B' });
  assert.equal(cedula.status, 400);
  const celular = await request(app).post('/api/personas').set(auth(admin)).send({ cedula: '1710034065', nombres: 'A', apellidos: 'B', celular: '12345' });
  assert.equal(celular.status, 400);
});

test('restablecer contraseña revoca las sesiones abiertas del comunero', async () => {
  const objetivo = await crearUsuario();
  const res = await request(app).post(`/api/personas/${objetivo.personaId}/cuenta/restablecer-password`).set(auth(admin));
  assert.equal(res.status, 200);
  assert.ok(res.body.passwordTemporal);
  assert.equal((await request(app).get('/api/auth/me').set(auth(objetivo))).status, 401);
});

test('un administrador no puede modificar su propia cuenta, pero sí la de otro', async () => {
  assert.equal((await request(app).patch(`/api/personas/${admin.personaId}/cuenta`).set(auth(admin)).send({ rol: 'USUARIO' })).status, 403);
  const otroAdmin = await crearUsuario({ rol: 'ADMIN' });
  const res = await request(app).patch(`/api/personas/${otroAdmin.personaId}/cuenta`).set(auth(admin)).send({ rol: 'USUARIO' });
  assert.equal(res.status, 200);
  assert.equal((await request(app).get('/api/personas').set(auth(otroAdmin))).status, 403);
});

test('la paginación de comuneros tiene un máximo de 100', async () => {
  const res = await request(app).get('/api/personas?limit=5000').set(auth(admin));
  assert.equal(res.status, 400);
});

test('al actualizar una persona sin enviar estado, conserva su estado actual', async () => {
  const objetivo = await crearUsuario({ rol: 'USUARIO' });
  await db.query('UPDATE personas SET estado = "INACTIVO" WHERE id = ?', [objetivo.personaId]);

  const res = await request(app).put(`/api/personas/${objetivo.personaId}`).set(auth(admin)).send({
    nombres: 'Modificado', apellidos: 'Apellido'
  });
  assert.equal(res.status, 200);

  const final = await db.query('SELECT estado FROM personas WHERE id = ?', [objetivo.personaId]);
  assert.equal(final[0][0].estado, 'INACTIVO');
});

test('un administrador no puede desactivar su propio registro de persona', async () => {
  const res = await request(app).put(`/api/personas/${admin.personaId}`).set(auth(admin)).send({
    nombres: 'Modificado', apellidos: 'Apellido', estado: 'INACTIVO'
  });
  assert.equal(res.status, 403);
  assert.match(res.body.message, /No puede desactivar su propio registro/);
});

