const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function entornoAsamblea({ evento = {}, query } = {}) {
  const asamblea = {
    id: 10,
    tipo: 'ASAMBLEA',
    titulo: 'Asamblea General Ordinaria',
    estado: 'BORRADOR',
    fecha: '2026-10-15',
    hora_inicio: '18:00',
    genera_multa_ausencia: 1,
    valor_multa: '15.00',
    ...evento
  };
  const operaciones = [];
  const connection = {
    beginTransaction: async () => operaciones.push('BEGIN'),
    commit: async () => operaciones.push('COMMIT'),
    rollback: async () => operaciones.push('ROLLBACK'),
    release: () => operaciones.push('RELEASE'),
    query: async (sql, params) => {
      operaciones.push({ sql, params });
      if (query) {
        const res = query(sql, params);
        if (res) return res;
      }
      if (sql.includes('FROM eventos WHERE id = ?')) return [[asamblea]];
      if (sql.includes('COUNT(*) AS total FROM asistencias')) return [[{ total: asamblea._asistenciasTotal !== undefined ? asamblea._asistenciasTotal : 10 }]];
      if (sql.includes('FROM puntos_asamblea WHERE evento_id = ?')) return [[]];
      if (sql.includes('FROM puntos_asamblea WHERE id = ?')) return [[{ id: 1, evento_id: 10, orden: 1, punto_tratar: 'Punto 1', estado_acta: 'BORRADOR' }]];
      if (sql.includes('FROM conceptos_cobro')) return [[{ id: 4 }]];
      if (sql.includes('FROM asistencias WHERE evento_id = ? AND estado = \'AUSENTE\'')) return [[{ persona_id: 5 }]];
      return [{ affectedRows: 1, insertId: 99 }];
    }
  };

  const context = {
    Buffer,
    console,
    __dirname: path.join(__dirname, '../src/controllers'),
    module: { exports: {} },
    require: nombre => {
      if (nombre === '../config/db') {
        return {
          getConnection: async () => connection,
          query: async (sql, params) => {
            operaciones.push({ sql, params });
            if (query) {
              const res = query(sql, params);
              if (res) return res;
            }
            if (sql.includes('FROM eventos WHERE id = ?')) return [[asamblea]];
            if (sql.includes('FROM puntos_asamblea WHERE id = ?')) return [[{ id: 1, evento_id: 10, orden: 1, punto_tratar: 'Punto 1', estado_acta: 'BORRADOR' }]];
            if (sql.includes('FROM puntos_asamblea WHERE evento_id = ?')) return [[]];
            return [{ affectedRows: 1, insertId: 99 }];
          }
        };
      }
      if (nombre === '../services/auditService') return { registrarAuditoria: async () => {} };
      if (nombre === 'pdfkit') return function() { return { on: () => {}, end: () => {}, pipe: () => {} }; };
      if (nombre === 'fs' || nombre === 'fs/promises' || nombre === 'path') return require(nombre);
      throw new Error(`Modulo no soportado: ${nombre}`);
    }
  };

  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/controllers/eventoController.js'), 'utf8'), context);
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
  const req = {
    params: { id: '10' },
    body: {},
    user: { cuentaId: 1 },
    ip: '127.0.0.1'
  };
  return { api: context.module.exports, req, res, operaciones };
}

const siguiente = err => { if (err) throw err; };

test('cambiarEstado permite avanzar a PROGRAMADO y CONVOCADO para asambleas', async () => {
  const e = entornoAsamblea();
  e.req.body.estado = 'PROGRAMADO';
  await e.api.cambiarEstado(e.req, e.res, siguiente);
  assert.equal(e.res.statusCode, 200);
  assert.equal(e.res.body.estado, 'PROGRAMADO');
  assert.ok(e.operaciones.some(o => o.sql?.includes('UPDATE eventos SET estado = ?')));
});

test('cambiarEstado rechaza estados inválidos', async () => {
  const e = entornoAsamblea();
  e.req.body.estado = 'ESTADO_INVALIDO';
  await e.api.cambiarEstado(e.req, e.res, siguiente);
  assert.equal(e.res.statusCode, 400);
});

test('savePuntosAsamblea guarda múltiples actas por punto tratado (F07)', async () => {
  const e = entornoAsamblea();
  e.req.body.puntos = [
    { orden: 1, punto_tratar: 'Constatación del cuórum', tratado: 'Se verifica el 75% de asistencia', resolucion: 'Instalada' },
    { orden: 2, punto_tratar: 'Presupuesto 2026', tratado: 'Debate de cuotas', resolucion: 'Aprobado incremento $2.00', titulo_acta: 'Acta de Aprobación de Presupuesto', estado_acta: 'APROBADA' }
  ];
  await e.api.savePuntosAsamblea(e.req, e.res, siguiente);
  assert.equal(e.res.statusCode, 200);
  assert.equal(e.res.body.status, 'OK');
  assert.ok(e.operaciones.some(o => o.sql?.includes('INSERT INTO puntos_asamblea')));
  assert.ok(e.operaciones.some(o => o.sql?.includes('COMMIT') || o === 'COMMIT'));
});

test('cambiarEstadoActaPunto actualiza resolución y estado de un acta específica (F07)', async () => {
  const e = entornoAsamblea();
  e.req.params.puntoId = '1';
  e.req.body = {
    estado_acta: 'APROBADA',
    resolucion: 'Resolución aprobada por unanimidad',
    responsables: 'Comisión de Riego'
  };
  await e.api.cambiarEstadoActaPunto(e.req, e.res, siguiente);
  assert.equal(e.res.statusCode, 200);
  assert.equal(e.res.body.status, 'OK');
  assert.ok(e.operaciones.some(o => o.sql?.includes('UPDATE puntos_asamblea SET updated_at = NOW()')));
});

test('guardarDocumentoEvento asocia el archivo firmado a un punto tratado cuando se envía punto_id (F07)', async () => {
  const e = entornoAsamblea();
  e.req.body = {
    tipo: 'ACTA',
    nombre_archivo: 'Acta_Punto_1_Firmada.pdf',
    contenido_base64: 'data:application/pdf;base64,JVBERi0xLjQKJcTl8uXr',
    punto_id: 1
  };
  await e.api.guardarDocumentoEvento(e.req, e.res, siguiente);
  assert.equal(e.res.statusCode, 200);
  assert.equal(e.res.body.status, 'OK');
  assert.equal(e.res.body.punto_id, 1);
  assert.ok(e.operaciones.some(o => o.sql?.includes('UPDATE puntos_asamblea')));
});

test('finalizarEventoYGenerarMultas rechaza finalizar asamblea con fecha futura o en BORRADOR', async () => {
  // Caso 1: En BORRADOR
  const e1 = entornoAsamblea({ evento: { estado: 'BORRADOR', fecha: '2020-01-01' } });
  await e1.api.finalizarEventoYGenerarMultas(e1.req, e1.res, siguiente);
  assert.equal(e1.res.statusCode, 409);
  assert.match(e1.res.body.message, /borrador/i);

  // Caso 2: Con fecha futura
  const e2 = entornoAsamblea({ evento: { estado: 'CONVOCADO', fecha: '2099-12-31' } });
  await e2.api.finalizarEventoYGenerarMultas(e2.req, e2.res, siguiente);
  assert.equal(e2.res.statusCode, 409);
  assert.match(e2.res.body.message, /fecha programada/i);
});

test('finalizarEventoYGenerarMultas rechaza finalizar asamblea sin asistencia registrada', async () => {
  const e = entornoAsamblea({ evento: { estado: 'CONVOCADO', fecha: '2020-01-01', _asistenciasTotal: 0 } });
  await e.api.finalizarEventoYGenerarMultas(e.req, e.res, siguiente);
  assert.equal(e.res.statusCode, 409);
  assert.match(e.res.body.message, /sin haber registrado la asistencia/i);
});

test('finalizarEventoYGenerarMultas finaliza asamblea convocada con fecha válida y asistencia registrada', async () => {
  const e = entornoAsamblea({ evento: { estado: 'CONVOCADO', fecha: '2020-01-01', _asistenciasTotal: 10 } });
  await e.api.finalizarEventoYGenerarMultas(e.req, e.res, siguiente);
  assert.equal(e.res.statusCode, 200);
  assert.equal(e.res.body.status, 'OK');
  assert.ok(e.operaciones.some(o => o.sql?.includes("UPDATE eventos SET estado = 'REALIZADO'")));
});

