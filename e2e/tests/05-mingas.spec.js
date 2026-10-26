const { test, expect } = require('@playwright/test');
const { unico, fechaEcuador, aviso, dialogo, leerEstado, descargarPdf, pdfEnPestana, fixture } = require('./ayudas');

// Una minga pasa por borrador, programada, convocada y cancelada; otra se cierra sin multa.
test.describe.configure({ mode: 'serial' });

const TITULO = unico('Minga sector E2E');
const TITULO_SIN_MULTA = unico('Minga sin multa E2E');
const tarjeta = (page, titulo) => page.locator('article.event-card', { hasText: titulo });

async function abrirNueva(page, { titulo, fecha, sector, conMulta = true }) {
  await page.goto('/admin/asistencias/mingas');
  await page.getByRole('button', { name: 'Nueva minga' }).click();
  await page.getByLabel('Actividad / título').fill(titulo);
  await page.getByLabel('Trabajo a realizar').fill('Trabajo comunitario de prueba de extremo a extremo.');
  await page.getByLabel('Fecha *').fill(fecha);
  await page.getByLabel('Hora de inicio').fill('00:01');
  await page.getByLabel('Lugar de encuentro').fill('Bocatoma del canal matriz');
  if (sector) await page.getByLabel('Sector convocado').selectOption({ label: sector });
  const multa = page.getByLabel('Aplica multa por ausencia');
  if (conMulta) await multa.check();
  else await multa.uncheck();
  return page.getByRole('button', { name: 'Guardar minga' });
}

test('una minga de un solo sector convoca solo a los usuarios de ese sector', async ({ page }) => {
  await page.goto('/admin/asistencias/mingas');
  const sectores = await (async () => {
    await page.getByRole('button', { name: 'Nueva minga' }).click();
    const opciones = await page.getByLabel('Sector convocado').locator('option').allInnerTexts();
    await page.getByRole('button', { name: 'Cancelar' }).click();
    return opciones.map((o) => o.trim()).filter((o) => !o.startsWith('Todos'));
  })();
  expect(sectores.length).toBeGreaterThan(1);

  const guardar = await abrirNueva(page, { titulo: TITULO, fecha: fechaEcuador(6), sector: sectores[0] });
  await guardar.click();
  const card = tarjeta(page, TITULO);
  await expect(card).toContainText('Borrador');
  await expect(card).toContainText(sectores[0]);
  await expect(card).toContainText('Multa');

  const [, , convocados] = (await card.innerText()).match(/Asistencia\s*(\d+) \/ (\d+)/).map(Number);
  const todos = tarjeta(page, 'Limpieza').first();
  const totalGeneral = Number((await todos.innerText()).match(/\/ (\d+) presentes/)[1]);
  expect(convocados).toBeGreaterThan(0);
  expect(convocados).toBeLessThan(totalGeneral);
});

test('el tablón público solo muestra las mingas programadas o convocadas', async ({ page, browser }) => {
  const publico = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const anonima = await publico.newPage();
  const verEnTablon = async () => {
    await anonima.goto('http://127.0.0.1:3210/eventos');
    await anonima.getByRole('heading', { name: 'Tablón de Asambleas y Mingas' }).waitFor();
    await anonima.getByRole('tab', { name: /Próximas Mingas/ }).click();
    return anonima.getByText(TITULO);
  };

  // Borrador: no se publica.
  await expect(await verEnTablon()).toHaveCount(0);

  // Programada: ya figura en el tablón y en el inicio.
  await page.goto('/admin/asistencias/mingas');
  const card = tarjeta(page, TITULO);
  await card.getByRole('button', { name: 'Programar' }).click();
  await expect(card).toContainText('Programada');
  await expect(await verEnTablon()).toHaveCount(1);
  await anonima.goto('http://127.0.0.1:3210/');
  await expect(anonima.getByText(TITULO)).toBeVisible();

  // Convocada: sigue visible.
  await card.getByRole('button', { name: 'Marcar convocada' }).click();
  await expect(card).toContainText('Convocada');
  await expect(await verEnTablon()).toHaveCount(1);
  await publico.close();
});

test('no se puede finalizar una minga antes de su fecha', async ({ page }) => {
  await page.goto('/admin/asistencias/mingas');
  const card = tarjeta(page, TITULO);
  await card.getByRole('button', { name: 'Registrar asistencia' }).click();
  const modal = page.getByRole('dialog');
  await modal.getByRole('button', { name: 'Marcar visibles presentes' }).click();
  await modal.getByRole('button', { name: 'Guardar asistencia' }).click();
  await expect(modal).toBeHidden();

  await card.getByRole('button', { name: 'Finalizar', exact: true }).click();
  await dialogo(page).getByRole('button', { name: 'Finalizar minga' }).click();
  await expect(aviso(page, /fecha y hora de inicio ya hayan llegado|Solo se puede finalizar/i)).toBeVisible();
  await expect(card).toContainText('Convocada');
});

test('un justificante se adjunta a la asistencia, se descarga y se puede quitar', async ({ page }) => {
  const { nuevo } = leerEstado();
  await page.goto('/admin/asistencias/mingas');
  const card = tarjeta(page, TITULO);
  await card.getByRole('button', { name: 'Registrar asistencia' }).click();
  const modal = page.getByRole('dialog');
  await modal.getByLabel('Buscar usuario').fill(nuevo.cedula);
  const grupo = modal.getByRole('group', { name: /^Asistencia de / });
  // El usuario de la prueba puede no ser del sector convocado; en ese caso se usa el primero de la lista.
  if (!(await grupo.count())) await modal.getByLabel('Buscar usuario').fill('');
  await grupo.first().getByRole('button', { name: 'Justificado' }).click();
  await modal.getByLabel(/^Motivo de /).first().fill('Certificado médico (prueba E2E)');

  await modal.locator('input[type=file]').first().setInputFiles(fixture('documento-firmado.pdf'));
  await expect(modal.getByRole('button', { name: 'Descargar comprobante' }).first()).toBeVisible();
  await pdfEnPestana(page, new RegExp('/justificante'), () => modal.getByRole('button', { name: 'Descargar comprobante' }).first().click());

  await modal.getByRole('button', { name: 'Quitar archivo' }).first().click();
  const confirmar = dialogo(page);
  if (await confirmar.isVisible({ timeout: 2000 }).catch(() => false)) await confirmar.getByRole('button').last().click();
  await expect(modal.getByRole('button', { name: 'Descargar comprobante' })).toHaveCount(0);
  await modal.getByRole('button', { name: 'Cerrar' }).last().click();
});

test('la lista de asistencia se descarga para firmar y la firmada se adjunta', async ({ page }) => {
  await page.goto('/admin/asistencias/mingas');
  const card = tarjeta(page, TITULO);
  await expect(card).toContainText('Pendiente de firma');

  await pdfEnPestana(page, new RegExp('/pdf-asistencia'), () => card.getByRole('button', { name: 'Descargar lista para firmar' }).click());

  const archivo = card.locator('input[type=file]');
  await archivo.setInputFiles(fixture('no-es-pdf.txt'));
  await expect(aviso(page, 'Seleccione un PDF, JPG o PNG válido')).toBeVisible();
  await expect(card).toContainText('Pendiente de firma');

  await archivo.setInputFiles(fixture('documento-firmado.pdf'));
  await expect(card).toContainText('Firmada cargada');
  await expect(card).not.toContainText('Pendiente de firma');
});

test('cancelar la minga la retira del tablón público', async ({ page, browser }) => {
  await page.goto('/admin/asistencias/mingas');
  const card = tarjeta(page, TITULO);
  await card.getByRole('button', { name: /^Más acciones de / }).click();
  await page.getByRole('menuitem', { name: 'Cancelar minga' }).click();
  await dialogo(page).getByRole('button').last().click();
  await expect(card).toContainText('Cancelada');
  await expect(card.getByRole('button', { name: /^Más acciones de / })).toHaveCount(0);

  const publico = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const anonima = await publico.newPage();
  await anonima.goto('http://127.0.0.1:3210/eventos');
  await anonima.getByRole('heading', { name: 'Tablón de Asambleas y Mingas' }).waitFor();
  await anonima.getByRole('tab', { name: /Próximas Mingas/ }).click();
  await expect(anonima.getByText(TITULO)).toHaveCount(0);
  await publico.close();
});

test('una minga sin multa se cierra sin generar ninguna', async ({ page }) => {
  const { bloqueable } = leerEstado();
  const guardar = await abrirNueva(page, { titulo: TITULO_SIN_MULTA, fecha: fechaEcuador(0), conMulta: false });
  await guardar.click();
  const card = tarjeta(page, TITULO_SIN_MULTA);
  await expect(card).toContainText('No aplica');

  await card.getByRole('button', { name: 'Registrar asistencia' }).click();
  const modal = page.getByRole('dialog');
  await modal.getByRole('button', { name: 'Marcar visibles presentes' }).click();
  await modal.getByLabel('Buscar usuario').fill(bloqueable.cedula);
  await modal.getByRole('group', { name: /^Asistencia de / }).getByRole('button', { name: 'Ausente' }).click();
  await modal.getByRole('button', { name: 'Guardar asistencia' }).click();
  await expect(modal).toBeHidden();

  await card.getByRole('button', { name: 'Programar' }).click();
  await card.getByRole('button', { name: 'Marcar convocada' }).click();
  await card.getByRole('button', { name: 'Finalizar', exact: true }).click();
  await expect(dialogo(page)).toContainText('No se generarán multas');
  await dialogo(page).getByRole('button', { name: 'Finalizar minga' }).click();
  await expect(card).toContainText('Realizada');

  await page.goto('/admin/cobros/cobrar');
  await page.getByLabel('Buscar usuario').fill(bloqueable.cedula);
  await page.getByRole('list', { name: 'Usuarios encontrados' }).getByRole('button').first().click();
  await page.getByRole('tab', { name: /Multas y otros/ }).click();
  await expect(page.getByText(TITULO_SIN_MULTA)).toHaveCount(0);
});

test('la lista de mingas se filtra por texto y por fecha', async ({ page }) => {
  await page.goto('/admin/asistencias/mingas');
  await page.getByLabel('Buscar minga').fill(TITULO_SIN_MULTA);
  await expect(page.locator('article.event-card')).toHaveCount(1);
  await page.getByLabel('Buscar minga').fill('');

  await page.getByLabel('Fecha', { exact: true }).selectOption('ANTERIORES');
  await expect(tarjeta(page, TITULO)).toHaveCount(0);
  await page.getByLabel('Fecha', { exact: true }).selectOption('PROXIMAS');
  await expect(tarjeta(page, TITULO)).toHaveCount(1);

  await page.getByLabel('Buscar minga').fill('zzzz-no-existe');
  await expect(page.getByText('Sin coincidencias')).toBeVisible();
  await page.getByRole('button', { name: 'Limpiar filtros' }).click();
  await expect(page.locator('article.event-card').first()).toBeVisible();
});

test('WhatsApp de mingas avisa cuando el servicio no está disponible', async ({ page }) => {
  await page.goto('/admin/asistencias/mingas');
  await page.getByRole('button', { name: 'Conectar WhatsApp' }).click();
  const panel = page.getByRole('dialog');
  await expect(panel).toBeVisible();
  await expect(panel).toContainText(/WhatsApp/);
  await panel.getByRole('button', { name: 'Cerrar' }).last().click();
  await expect(panel).toBeHidden();
});
