const { resetDatabase, closeDatabase } = require('../helpers/testEnv');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const app = require('../../src/app');
const db = require('../../src/config/db');
const { crearUsuario, auth, crearObligacion } = require('../helpers/fixtures');

let admin, comunero;
let periodo = 0;

before(async () => {
  await resetDatabase();
  admin = await crearUsuario({ rol: 'ADMIN' });
  comunero = await crearUsuario();
});
after(closeDatabase);

async function pagar(cuerpo) {
  const ob = await crearObligacion({ personaId: comunero.personaId, mes: 1, anio: 2000 + ++periodo });
  const res = await request(app).post('/api/financiero/pagos').set(auth(admin))
    .send({ persona_id: comunero.personaId, obligacionesIds: [ob], ...cuerpo });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const [[pago]] = await db.query('SELECT observacion FROM pagos WHERE id = ?', [res.body.pagoId]);
  return pago.observacion;
}

test('registra la observación del pago', async () => {
  assert.equal(await pagar({ observacion: 'Pago en ventanilla' }), 'Pago en ventanilla');
});

test('acepta "observaciones" por compatibilidad y prioriza "observacion"', async () => {
  assert.equal(await pagar({ observaciones: 'Desde el panel' }), 'Desde el panel');
  assert.equal(await pagar({ observacion: '  Principal  ', observaciones: 'Secundaria' }), 'Principal');
});

test('guarda null si la observación viene vacía', async () => {
  assert.equal(await pagar({ observacion: '   ', observaciones: '' }), null);
});
