const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const schemaPath = path.join(__dirname, '../database/schema.sql');
const seedPath = path.join(__dirname, '../database/seed.sql');

test('el esquema SQL contiene exactamente las 22 tablas depuradas', () => {
  const schemaContent = fs.readFileSync(schemaPath, 'utf8');
  const tableMatches = [...schemaContent.matchAll(/CREATE TABLE IF NOT EXISTS\s+(\w+)/gi)].map(m => m[1]);

  assert.equal(tableMatches.length, 22, `Se esperaban 22 tablas pero se encontraron ${tableMatches.length}`);

  const tablasDepuradas = ['cargos_directiva', 'miembros_directiva', 'proveedores'];
  for (const tabla of tablasDepuradas) {
    assert.ok(!tableMatches.includes(tabla), `La tabla depurada ${tabla} no debe estar en el esquema`);
  }
});

test('las columnas sin uso identificadas no existen en el esquema SQL', () => {
  const schemaContent = fs.readFileSync(schemaPath, 'utf8');

  // lotes.imagen_url
  assert.ok(!schemaContent.includes('imagen_url VARCHAR'), 'lotes no debe tener imagen_url');

  // persona_lotes.fecha_hasta
  assert.ok(!schemaContent.includes('fecha_hasta DATE'), 'persona_lotes no debe tener fecha_hasta');

  // obligaciones.tarifa_id
  assert.ok(!schemaContent.includes('tarifa_id BIGINT'), 'obligaciones no debe tener tarifa_id');

  // envios_convocatoria.proveedor_externo_id
  assert.ok(!schemaContent.includes('proveedor_externo_id VARCHAR'), 'envios_convocatoria no debe tener proveedor_externo_id');
});

test('todas las foreign keys en el schema apuntan a tablas existentes', () => {
  const schemaContent = fs.readFileSync(schemaPath, 'utf8');
  const tableMatches = [...schemaContent.matchAll(/CREATE TABLE IF NOT EXISTS\s+(\w+)/gi)].map(m => m[1]);
  const fkMatches = [...schemaContent.matchAll(/REFERENCES\s+(\w+)\s*\(/gi)].map(m => m[1]);

  for (const refTable of fkMatches) {
    assert.ok(
      tableMatches.includes(refTable),
      `La clave foranea referencia a '${refTable}', pero no existe en las tablas activas.`
    );
  }
});

test('el archivo seed.sql no contiene referencias a tablas o entidades depuradas', () => {
  const seedContent = fs.readFileSync(seedPath, 'utf8');

  assert.ok(!seedContent.includes('cargos_directiva'), 'seed.sql no debe mencionar cargos_directiva');
  assert.ok(!seedContent.includes('miembros_directiva'), 'seed.sql no debe mencionar miembros_directiva');
  assert.ok(!seedContent.includes('proveedores'), 'seed.sql no debe mencionar proveedores');
});
