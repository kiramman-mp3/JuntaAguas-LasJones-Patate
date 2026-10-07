const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function crearEntornoControlador(archivoRelativo, mockQuery) {
  const operaciones = [];
  const connection = {
    beginTransaction: async () => operaciones.push('BEGIN'),
    commit: async () => operaciones.push('COMMIT'),
    rollback: async () => operaciones.push('ROLLBACK'),
    release: () => operaciones.push('RELEASE'),
    query: async (sql, params) => {
      operaciones.push({ sql, params });
      return mockQuery(sql, params);
    }
  };

  const context = {
    module: { exports: {} },
    require: nombre => {
      if (nombre === '../config/db') {
        return {
          getConnection: async () => connection,
          query: async (sql, params) => {
            operaciones.push({ sql, params });
            return mockQuery(sql, params);
          }
        };
      }
      if (nombre === '../services/auditService') {
        return { registrarAuditoria: async () => {} };
      }
      if (nombre === '../utils/loteCodigo') {
        return require(path.join(__dirname, '../src/utils/loteCodigo'));
      }
      if (nombre === 'pdfkit') {
        return function() { return { on: () => {}, end: () => {} }; };
      }
      if (nombre === 'bcryptjs') {
        return { hash: async () => 'hash123', compare: async () => true };
      }
      if (nombre === 'fs' || nombre === 'fs/promises' || nombre === 'path') {
        return require(nombre);
      }
      throw new Error(`Modulo mock no reconocido: ${nombre}`);
    }
  };

  const code = fs.readFileSync(path.join(__dirname, archivoRelativo), 'utf8');
  vm.runInNewContext(code, context);

  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };

  const req = {
    query: {},
    params: {},
    body: {},
    user: { cuentaId: 1, rol: 'ADMIN', cedula: '1800000001' },
    ip: '127.0.0.1'
  };

  return { api: context.module.exports, req, res, operaciones };
}

const siguiente = err => { if (err) throw err; };

test('getPersonas devuelve payload optimizado con paginacion y sin password_hash', async () => {
  const e = crearEntornoControlador('../src/controllers/personaController.js', (sql) => {
    if (sql.includes('COUNT(*) AS total')) {
      return [[{ total: 1 }]];
    }
    return [[{
      id: 1,
      cedula: '1800000001',
      nombres: 'Carlos',
      apellidos: 'Moreta',
      direccion: 'Patate',
      telefono: '032850123',
      celular: '0987654321',
      email: 'admin@junta.com',
      estado: 'ACTIVO',
      lotes_count: 2
    }]];
  });

  await e.api.getPersonas(e.req, e.res, siguiente);

  assert.equal(e.res.statusCode, 200);
  assert.equal(e.res.body.status, 'OK');
  assert.equal(e.res.body.data.length, 1);
  assert.equal(e.res.body.data[0].cedula, '1800000001');
  assert.equal(e.res.body.data[0].password_hash, undefined, 'No debe filtrar password_hash');
  assert.equal(e.res.body.pagination.total, 1);
});

test('getLotes devuelve proyeccion optimizada con datos de lote, sector y propietario', async () => {
  const e = crearEntornoControlador('../src/controllers/loteController.js', () => {
    return [[{
      id: 10,
      sector_id: 1,
      codigo: 'LJA-001',
      superficie_m2: '2500.00',
      sector_nombre: 'La Jones Alta',
      propietario: 'Carlos Moreta (C.I. 1800000001)',
      propietarios: 'Carlos Moreta'
    }]];
  });

  await e.api.getLotes(e.req, e.res, siguiente);

  assert.equal(e.res.statusCode, 200);
  assert.equal(e.res.body.status, 'OK');
  assert.equal(e.res.body.data[0].codigo, 'LJA-001');
  assert.equal(e.res.body.data[0].sector_nombre, 'La Jones Alta');
  assert.ok(e.res.body.data[0].propietario.includes('Carlos Moreta'));
});

test('getTurnos devuelve horarios limpios con nombres de comunero y lote', async () => {
  const e = crearEntornoControlador('../src/controllers/turnoController.js', () => {
    return [[{
      id: 5,
      persona_id: 1,
      lote_id: 10,
      tipo: 'REGULAR',
      dia_semana: 1,
      hora_inicio: '08:00:00',
      hora_fin: '10:00:00',
      estado: 'ACTIVO',
      comunero_nombre: 'Carlos Moreta',
      lote_codigo: 'LJA-001',
      sector_nombre: 'La Jones Alta'
    }]];
  });

  await e.api.getTurnos(e.req, e.res, siguiente);

  assert.equal(e.res.statusCode, 200);
  assert.equal(e.res.body.status, 'OK');
  assert.equal(e.res.body.data[0].lote_codigo, 'LJA-001');
  assert.equal(e.res.body.data[0].comunero_nombre, 'Carlos Moreta');
});

test('getEventos devuelve lista de eventos con metricas de asistencia calculadas', async () => {
  const e = crearEntornoControlador('../src/controllers/eventoController.js', (sql) => {
    if (sql.includes('CREATE TABLE') || sql.includes('ALTER TABLE') || sql.includes('MODIFY COLUMN')) {
      return [{ affectedRows: 0 }];
    }
    return [[{
      id: 1,
      tipo: 'ASAMBLEA',
      titulo: 'Asamblea Anual 2026',
      fecha: '2026-10-15',
      hora_inicio: '09:00:00',
      estado: 'CONVOCADO',
      asistentes: 120,
      totalComuneros: 150
    }]];
  });

  await e.api.getEventos(e.req, e.res, siguiente);

  assert.equal(e.res.statusCode, 200);
  assert.equal(e.res.body.status, 'OK');
  assert.equal(e.res.body.data[0].titulo, 'Asamblea Anual 2026');
  assert.equal(e.res.body.data[0].asistentes, 120);
  assert.equal(e.res.body.data[0].totalComuneros, 150);
});
