const fs = require('fs');
const { test, expect } = require('@playwright/test');
const { ARCHIVO_CREDENCIALES } = require('../entorno');

// Los tres flujos comparten estado (la multa que nace en el primero se cobra en el segundo y se
// libera en el tercero), así que corren en orden y se detienen al primer fallo.
test.describe.configure({ mode: 'serial' });

const { usuario } = JSON.parse(fs.readFileSync(ARCHIVO_CREDENCIALES, 'utf8'));
const hoyEcuador = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Guayaquil' });
const anioActual = hoyEcuador.slice(0, 4);
const TITULO_MINGA = `Minga E2E ${Date.now()}`;
const REFERENCIA = `E2E-${Date.now()}`;
const VALOR_MULTA = '15.00';
const ARBOL = 'Obligaciones pendientes por año y mes';

/** Cobro en caja del usuario de la prueba, en la pestaña de multas y con el árbol de períodos abierto. */
async function abrirMultasPendientes(page) {
  await page.goto('/admin/cobros/cobrar');
  await page.getByLabel('Buscar usuario').fill(usuario.cedula);
  await page.getByRole('list', { name: 'Usuarios encontrados' }).getByRole('button').first().click();
  await page.getByRole('tab', { name: /Multas y otros/ }).click();
  const arbol = page.getByRole('list', { name: ARBOL });
  await expect(arbol).toBeVisible();
  // Año y mes empiezan cerrados: se abren de arriba abajo hasta ver las obligaciones.
  for (let i = 0; i < 4; i += 1) {
    const cerrados = arbol.locator('button[aria-expanded="false"]');
    if (!(await cerrados.count())) break;
    await cerrados.first().click();
  }
  return arbol;
}

test('una minga finalizada multa a quien faltó y solo a esa persona', async ({ page }) => {
  await page.goto('/admin/asistencias/mingas');
  await page.getByRole('button', { name: 'Nueva minga' }).click();

  await page.getByLabel('Actividad / título').fill(TITULO_MINGA);
  await page.getByLabel('Trabajo a realizar').fill('Prueba de extremo a extremo de la multa por ausencia.');
  await page.getByLabel('Fecha *').fill(hoyEcuador);
  await page.getByLabel('Hora de inicio').fill('00:01');
  await page.getByLabel('Lugar de encuentro').fill('Bocatoma del canal matriz');
  await page.getByRole('button', { name: /guardar|crear|programar/i }).last().click();

  const tarjeta = page.locator('article.event-card', { hasText: TITULO_MINGA });
  await expect(tarjeta).toBeVisible();

  // Asistencia: todos presentes salvo el usuario de la prueba.
  await tarjeta.getByRole('button', { name: 'Registrar asistencia' }).click();
  const modal = page.getByRole('dialog');
  await modal.getByRole('button', { name: 'Marcar visibles presentes' }).click();
  await modal.getByLabel('Buscar usuario').fill(usuario.cedula);
  await modal.getByRole('group', { name: /^Asistencia de / }).getByRole('button', { name: 'Ausente' }).click();
  await modal.getByRole('button', { name: 'Guardar asistencia' }).click();
  await expect(modal).toBeHidden();

  // Estados hasta finalizar; la confirmación debe anunciar una sola ausencia.
  await tarjeta.getByRole('button', { name: 'Programar' }).click();
  await tarjeta.getByRole('button', { name: 'Marcar convocada' }).click();
  await tarjeta.getByRole('button', { name: 'Finalizar', exact: true }).click();
  const confirmacion = page.getByRole('alertdialog').or(page.getByRole('dialog')).last();
  await expect(confirmacion).toContainText('1 ausentes');
  await confirmacion.getByRole('button', { name: 'Finalizar minga' }).click();
  await expect(tarjeta.getByText('Realizada')).toBeVisible();

  // La multa existe, vale lo configurado y está pendiente de cobro.
  const arbol = await abrirMultasPendientes(page);
  await expect(arbol).toContainText(`Multa por ausencia a MINGA (${hoyEcuador}): ${TITULO_MINGA}`);
  await expect(arbol).toContainText(VALOR_MULTA);
});

test('el cobro en caja registra el pago y deja al usuario sin la multa pendiente', async ({ page }) => {
  await abrirMultasPendientes(page);
  await page.getByLabel(`Seleccionar todo ${anioActual}`).check();
  await expect(page.locator('.summary__total')).toHaveText(`$${VALOR_MULTA}`);

  // Sin número de referencia el pago no se puede registrar.
  await expect(page.getByRole('button', { name: 'Registrar pago' })).toBeDisabled();
  await page.getByRole('radio', { name: 'Transferencia' }).click();
  await page.getByLabel('Número de referencia').fill(REFERENCIA);
  await page.getByRole('button', { name: 'Registrar pago' }).click();
  await expect(page.locator('strong', { hasText: /Pago .+ registrado/ })).toBeVisible();

  await page.getByRole('button', { name: 'Seguir cobrando a este usuario' }).click();
  await page.getByRole('tab', { name: /Multas y otros/ }).click();
  await expect(page.getByText(TITULO_MINGA)).toHaveCount(0);
});

test('anular el pago exige un motivo y devuelve la multa a pendiente', async ({ page }) => {
  await page.goto('/admin/historial/pagos');
  await page.getByLabel('Buscar', { exact: true }).fill(usuario.cedula);
  const fila = page.getByRole('row').filter({ hasText: usuario.cedula });
  await expect(fila).toHaveCount(1);
  await expect(fila).not.toContainText('Anulado');

  // Un motivo demasiado corto se rechaza y el pago sigue vigente.
  await fila.getByRole('button', { name: /^Anular pago / }).click();
  const confirmacion = page.getByRole('alertdialog').or(page.getByRole('dialog')).last();
  await confirmacion.getByPlaceholder('Motivo de la anulación').fill('no');
  await confirmacion.getByRole('button', { name: 'Anular pago' }).click();
  await expect(fila).not.toContainText('Anulado');

  await fila.getByRole('button', { name: /^Anular pago / }).click();
  await confirmacion.getByPlaceholder('Motivo de la anulación').fill('Referencia bancaria mal digitada (prueba E2E)');
  await confirmacion.getByRole('button', { name: 'Anular pago' }).click();
  await expect(fila).toContainText('Anulado');

  // Las obligaciones vuelven a estar pendientes para poder cobrarlas de nuevo.
  const arbol = await abrirMultasPendientes(page);
  await expect(arbol).toContainText(TITULO_MINGA);
});
