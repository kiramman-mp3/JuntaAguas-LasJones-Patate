const { test } = require('node:test');
const assert = require('node:assert/strict');
const codigos = require('../../src/utils/loteCodigo');

test('conserva el prefijo fijo del sector y normaliza letras', () => {
  assert.equal(codigos.prefijoSector('La Jones Alto'), 'LJA');
  assert.equal(codigos.prefijoSector('Árbol del río'), 'ADR');
  assert.equal(codigos.prefijoSector('Sector Las Jones Alto'), 'LJA');
  assert.equal(codigos.prefijoSector('La Jones Baja'), 'LJB');
  assert.equal(codigos.prefijoSector('Sector Las Jones Centro'), 'LJC');
  assert.equal(codigos.prefijoSector('El Tambo'), 'ELT');
  assert.equal(codigos.prefijoSector('Los Cuyes'), 'LCU');
  assert.equal(codigos.prefijoSector('Sector Árbol del río'), 'ADR');
  assert.equal(codigos.normalizarCodigo(' lja-001 '), 'LJA-001');
  assert.equal(codigos.FORMATO_CODIGO_LOTE.test('LJA-1000'), true);
  assert.equal(codigos.FORMATO_CODIGO_LOTE.test('LJA-1'), false);
});
