const { resetDatabase, closeDatabase } = require('../helpers/testEnv');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const app = require('../../src/app');
const db = require('../../src/config/db');
const { crearUsuario, auth } = require('../helpers/fixtures');

let admin, usuario;

before(async () => {
  await resetDatabase();
  admin = await crearUsuario({ rol: 'ADMIN' });
  usuario = await crearUsuario();
});
after(closeDatabase);

const registrar = (cuerpo, quien = admin) => request(app).post('/api/inventario').set(auth(quien)).send(cuerpo);

test('solo la directiva consulta y registra el inventario', async () => {
  assert.equal((await request(app).get('/api/inventario')).status, 401);
  assert.equal((await request(app).get('/api/inventario').set(auth(usuario))).status, 403);
  assert.equal((await registrar({ nombre: 'Pala', valor_unitario: 10 }, usuario)).status, 403);
});

test('registra un bien con sus valores por defecto y deja la auditoría', async () => {
  const res = await registrar({ codigo: 'INV-100', nombre: 'Pala de punta', valor_unitario: 12.5, cantidad: 4, estado_fisico: 'nuevo' });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const [[bien]] = await db.query('SELECT codigo, nombre, cantidad, valor_unitario, estado_fisico, activo FROM bienes_inventario WHERE id = ?', [res.body.bienId]);
  assert.deepEqual({ ...bien, activo: Boolean(bien.activo) }, { codigo: 'INV-100', nombre: 'Pala de punta', cantidad: 4, valor_unitario: 12.5, estado_fisico: 'NUEVO', activo: true });
  const [auditoria] = await db.query("SELECT 1 FROM auditoria WHERE entidad = 'bienes_inventario' AND entidad_id = ?", [res.body.bienId]);
  assert.equal(auditoria.length, 1);

  const sinCodigo = await registrar({ nombre: 'Machete', valor_unitario: 8 });
  assert.equal(sinCodigo.status, 201);
  const lista = await request(app).get('/api/inventario').set(auth(admin));
  assert.deepEqual(lista.body.data.map((b) => b.nombre), ['Machete', 'Pala de punta'], 'ordenado por nombre');
});

test('valida los datos y rechaza códigos repetidos', async () => {
  for (const cuerpo of [{ valor_unitario: 1 }, { nombre: 'X', valor_unitario: 1 }, { nombre: 'Tubo', valor_unitario: -1 },
    { nombre: 'Tubo', valor_unitario: 1, cantidad: 0 }, { nombre: 'Tubo', valor_unitario: 1, estado_fisico: 'ROTO' }]) {
    assert.equal((await registrar(cuerpo)).status, 400, JSON.stringify(cuerpo));
  }
  const repetido = await registrar({ codigo: 'INV-100', nombre: 'Otra pala', valor_unitario: 12 });
  assert.equal(repetido.status, 409);
  assert.match(repetido.body.message, /INV-100/);
});
