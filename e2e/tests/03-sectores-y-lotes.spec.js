const { test, expect } = require('@playwright/test');
const { unico, aviso, guardarEstado, leerEstado, crearUsuarioConCuenta, buscarEnPadron } = require('./ayudas');

// Un sector nuevo recibe un lote, el lote se asigna a un usuario y luego se transfiere a otro.
test.describe.configure({ mode: 'serial' });

const filasCatastro = (page) => page.locator('tbody tr');

async function buscarLote(page, codigo) {
  await page.goto('/admin/usuarios/lotes');
  await page.getByLabel('Buscar lote').fill(codigo);
  await expect(filasCatastro(page)).toHaveCount(1);
  return filasCatastro(page).first();
}

/** Abre "Asignar terreno" de un usuario y deja elegido el lote por su código. */
async function abrirAsignacion(page, cedula, codigo) {
  const fila = await buscarEnPadron(page, cedula);
  await fila.getByRole('button', { name: /^Asignar terreno a / }).click();
  await page.getByLabel('Buscar lote').fill(codigo);
  const lote = page.locator('#vin-lote option', { hasText: `Lote ${codigo}` });
  await expect(lote).toHaveCount(1);
  await page.locator('#vin-lote').selectOption({ label: (await lote.innerText()).trim() });
}

test('crear un sector lo deja disponible para los lotes', async ({ page }) => {
  const sector = unico('Sector E2E');
  await page.goto('/admin/usuarios/lotes');
  await page.getByRole('button', { name: 'Nuevo sector' }).click();
  await page.getByLabel('Nombre del sector').fill(sector);
  await page.getByRole('button', { name: 'Guardar sector' }).click();
  await expect(aviso(page, `Sector ${sector} creado.`)).toBeVisible();
  guardarEstado({ sector });

  await page.reload();
  const opciones = await page.getByLabel('Sector', { exact: true }).locator('option').allInnerTexts();
  expect(opciones.map((o) => o.trim())).toContain(sector);
});

test('crear un lote valida el código, sugiere uno y registra la ubicación en el mapa', async ({ page }) => {
  const { sector } = leerEstado();
  await page.goto('/admin/usuarios/lotes');
  await page.getByRole('button', { name: 'Nuevo lote' }).click();
  const guardar = page.getByRole('button', { name: 'Guardar lote' });

  // Sin sector ni código el formulario no se puede guardar.
  await expect(guardar).toBeDisabled();
  await page.getByLabel('Sector *').selectOption({ label: sector });

  // Un código con formato incorrecto se señala.
  const codigo = page.getByLabel('Código interno *');
  await codigo.fill('malo');
  await codigo.blur();
  await expect(page.getByText('Ingrese un código como LJA-001')).toBeVisible();
  await expect(guardar).toBeDisabled();

  // "Sugerir" propone el siguiente código libre del sector.
  await page.getByRole('button', { name: 'Sugerir' }).click();
  await expect(codigo).toHaveValue(/^[A-Z]{3}-\d{3,8}$/);
  const codigoLote = await codigo.inputValue();

  await page.getByLabel('Superficie (m²)').fill('1500');
  await page.getByLabel('Referencia de ubicación').fill('Junto a la escuela (prueba E2E)');
  await page.locator('.lote-form__map .leaflet-container').click({ position: { x: 150, y: 120 } });
  await expect(page.locator('.coord-readout .money')).toContainText(/-?\d+\.\d+, -?\d+\.\d+/);

  await expect(guardar).toBeEnabled();
  await guardar.click();
  await expect(aviso(page, /lote/i)).toBeVisible();
  guardarEstado({ codigoLote });

  const fila = await buscarLote(page, codigoLote);
  await expect(fila).toContainText(sector);
  await expect(fila).toContainText('Sin dueño');
  await expect(fila).toContainText('1500 m²');
});

test('la ficha del lote muestra su titular, ubicación y referencia', async ({ page }) => {
  const { codigoLote, sector } = leerEstado();
  const fila = await buscarLote(page, codigoLote);
  await fila.getByRole('button', { name: 'Ver ficha' }).click();

  const ficha = page.getByRole('dialog');
  await expect(ficha).toContainText(codigoLote);
  await expect(ficha).toContainText(sector);
  await expect(ficha).toContainText('Sin dueño');
  await expect(ficha).toContainText('Junto a la escuela (prueba E2E)');
  await expect(ficha.locator('.leaflet-container')).toBeVisible();
  await ficha.getByRole('button', { name: 'Cerrar' }).last().click();
  await expect(ficha).toBeHidden();
});

test('el catastro filtra por código y por sector, y repite la búsqueda sin resultados', async ({ page }) => {
  const { codigoLote, sector } = leerEstado();
  await page.goto('/admin/usuarios/lotes');
  await page.getByLabel('Sector', { exact: true }).selectOption({ label: sector });
  await expect(filasCatastro(page)).toHaveCount(1);
  await expect(filasCatastro(page).first()).toContainText(codigoLote);

  await page.getByLabel('Sector', { exact: true }).selectOption({ index: 0 });
  await page.getByLabel('Buscar lote').fill('ZZZ-no-existe');
  await expect(page.getByText('Sin coincidencias')).toBeVisible();
  await page.getByRole('button', { name: 'Limpiar filtros' }).click();
  await expect(filasCatastro(page).first()).toBeVisible();
});

test('asignar el lote a un usuario lo convierte en su titular único', async ({ page }) => {
  const { nuevo, codigoLote } = leerEstado();
  await abrirAsignacion(page, nuevo.cedula, codigoLote);
  await expect(page.getByText('Titularidad única')).toBeVisible();
  await expect(page.getByRole('alert').filter({ hasText: 'pertenece a' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Asignar lote' }).click();
  await expect(aviso(page, /asign|vincul/i)).toBeVisible();

  const fila = await buscarLote(page, codigoLote);
  await expect(fila).toContainText(nuevo.nombres);
  await expect(fila).not.toContainText('Sin dueño');

  // El padrón cuenta el lote y lo lista.
  const filaUsuario = await buscarEnPadron(page, nuevo.cedula);
  await filaUsuario.getByRole('button', { name: /^1 lote/ }).click();
  await expect(page.getByRole('dialog')).toContainText(codigoLote);
  await page.getByRole('dialog').getByRole('button', { name: 'Cerrar' }).last().click();
});

test('transferir el lote avisa del titular actual y pasa el 100 % al nuevo usuario', async ({ page, request }) => {
  const { nuevo, codigoLote } = leerEstado();
  const receptor = await crearUsuarioConCuenta(request);
  guardarEstado({ receptor });

  await abrirAsignacion(page, receptor.cedula, codigoLote);
  const aviso100 = page.getByRole('alert').filter({ hasText: 'pertenece a' });
  await expect(aviso100).toContainText(nuevo.nombres);
  await expect(aviso100).toContainText('100 %');
  await page.getByRole('button', { name: 'Transferir lote' }).click();
  await expect(aviso(page, /transfer|asign|vincul/i)).toBeVisible();

  const fila = await buscarLote(page, codigoLote);
  await expect(fila).toContainText(receptor.nombres);
  await expect(fila).not.toContainText(nuevo.nombres);

  // El anterior titular se queda sin lotes; el nuevo tiene uno.
  const anterior = await buscarEnPadron(page, nuevo.cedula);
  await expect(anterior).toContainText(/0 lotes|Sin lotes/i);
  const actual = await buscarEnPadron(page, receptor.cedula);
  await expect(actual.getByRole('button', { name: /^1 lote/ })).toBeVisible();
});
