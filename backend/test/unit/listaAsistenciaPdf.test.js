const { test } = require('node:test');
const assert = require('node:assert/strict');
const { PassThrough } = require('node:stream');

const { escribirListaAsistencia } = require('../../src/services/listaAsistenciaPdf');

const evento = { tipo: 'ASAMBLEA', titulo: 'Asamblea ordinaria', fecha: '2026-11-10', hora_inicio: '18:00:00', genera_multa_ausencia: 0 };

/** Genera la hoja y devuelve su número de páginas. */
async function paginasDe(personas) {
  const salida = new PassThrough();
  const trozos = [];
  salida.on('data', (t) => trozos.push(t));
  const terminado = new Promise((resolver) => salida.on('end', resolver));
  escribirListaAsistencia(salida, evento, personas);
  await terminado;
  const pdf = Buffer.concat(trozos).toString('latin1');
  assert.ok(pdf.startsWith('%PDF'));
  return (pdf.match(/\/Type \/Page\b(?!s)/g) || []).length;
}

const persona = (i, nombre) => ({ cedula: String(1700000000 + i), nombre });

test('un nombre largo ocupa varios renglones y la hoja reserva su altura real (H-27)', async () => {
  const cortos = Array.from({ length: 60 }, (_, i) => persona(i, `Perez Juan ${i}`));
  const largos = Array.from({ length: 60 }, (_, i) =>
    persona(i, `${'Maria de los Angeles Fernanda del Carmen Acosta Villacis de la Torre '.repeat(4)}${i}`));

  const paginasCortos = await paginasDe(cortos);
  const paginasLargos = await paginasDe(largos);
  // Con altura fija las dos hojas ocuparían lo mismo y los nombres largos se pisarían entre filas.
  assert.ok(paginasLargos > paginasCortos, `${paginasLargos} páginas con nombres largos y ${paginasCortos} con cortos`);
});

test('cada renglón deja espacio para firmar: 25 nombres cortos ya no caben en una sola página', async () => {
  const cortos = Array.from({ length: 25 }, (_, i) => persona(i, `Perez Juan ${i}`));
  assert.equal(await paginasDe(cortos), 2);
});

test('el padrón se separa por sector: cada sector (y los usuarios sin lote) empieza en su página', async () => {
  const conSector = (i, sector) => ({ ...persona(i, `Perez Juan ${i}`), sector_nombre: sector });
  const mezclados = [
    conSector(1, 'San Javier'),
    conSector(2, 'La Merced'),
    conSector(3, null),
    conSector(4, 'San Javier'),
  ];
  assert.equal(await paginasDe(mezclados), 3);
  assert.equal(await paginasDe([conSector(1, 'La Merced'), conSector(2, 'La Merced')]), 1);
});

test('la hoja sin personas igual se genera', async () => {
  assert.equal(await paginasDe([]), 1);
});
