const { test, expect } = require('@playwright/test');
const { aviso, dialogo, leerEstado } = require('./ayudas');

// El turno de riego se asigna, se valida contra cruces de horario, se consulta en tres vistas, se edita y se elimina.
test.describe.configure({ mode: 'serial' });

const nombreCompleto = (u) => `${u.nombres} ${u.apellidos}`;

async function abrirAsignacion(page, usuario) {
  await page.goto('/admin/turnos');
  await page.getByRole('button', { name: 'Asignar turno' }).click();
  const modal = page.getByRole('dialog');
  await modal.getByLabel('Buscar usuario').fill(usuario.cedula);
  await modal.getByRole('listbox', { name: 'Usuarios' }).getByRole('option').first().click();
  await expect(modal.locator('#turno-lote')).toBeEnabled();
  await modal.locator('#turno-lote').selectOption({ index: 1 });
  return modal;
}

async function llenarHorario(modal, { dia, inicio, fin }) {
  await modal.locator('#turno-dia').selectOption({ label: dia });
  await modal.locator('#turno-inicio').fill(inicio);
  await modal.locator('#turno-fin').fill(fin);
}

test('asignar un turno exige usuario y lote, y rechaza un horario al revés', async ({ page }) => {
  const { receptor } = leerEstado();
  await page.goto('/admin/turnos');
  await page.getByRole('button', { name: 'Asignar turno' }).click();
  const modal = page.getByRole('dialog');
  await expect(modal.getByRole('button', { name: 'Guardar turno' })).toBeDisabled();
  await modal.getByRole('button', { name: 'Cancelar' }).click();

  const formulario = await abrirAsignacion(page, receptor);
  await llenarHorario(formulario, { dia: 'Miércoles', inicio: '09:00', fin: '08:00' });
  await formulario.getByRole('button', { name: 'Guardar turno' }).click();
  await expect(aviso(page, 'La hora de fin debe ser posterior a la de inicio.')).toBeVisible();
  await expect(formulario).toBeVisible();
});

test('un turno válido queda asignado al lote del usuario y aparece en la tabla', async ({ page }) => {
  const { receptor } = leerEstado();
  const formulario = await abrirAsignacion(page, receptor);
  await llenarHorario(formulario, { dia: 'Miércoles', inicio: '06:00', fin: '08:00' });
  await formulario.locator('#turno-obs').fill('Riego por la toma norte (prueba E2E)');
  await formulario.getByRole('button', { name: 'Guardar turno' }).click();
  await expect(aviso(page, /Turno de agua asignado|asignado/i)).toBeVisible();

  await page.getByLabel('Buscar turno').fill(receptor.nombres);
  const fila = page.locator('tbody tr');
  await expect(fila).toHaveCount(1);
  await expect(fila).toContainText(nombreCompleto(receptor));
  await expect(fila).toContainText('Miércoles');
  await expect(fila).toContainText('06:00');
  await expect(fila).toContainText('08:00');
});

test('dos turnos que se cruzan en el mismo sector no se permiten', async ({ page }) => {
  const { receptor } = leerEstado();
  const formulario = await abrirAsignacion(page, receptor);
  await llenarHorario(formulario, { dia: 'Miércoles', inicio: '07:00', fin: '09:00' });
  await formulario.getByRole('button', { name: 'Guardar turno' }).click();
  await expect(page.locator('.toast--error, .toast--danger, .toast--warning').first()).toBeVisible();
  await expect(formulario).toBeVisible();

  // Un horario contiguo (sin solaparse) sí es válido.
  await llenarHorario(formulario, { dia: 'Miércoles', inicio: '08:00', fin: '09:00' });
  await formulario.getByRole('button', { name: 'Guardar turno' }).click();
  await expect(formulario).toBeHidden();
});

test('la ficha del turno muestra sus datos y permite editarlo', async ({ page }) => {
  const { receptor } = leerEstado();
  await page.goto('/admin/turnos');
  await page.getByLabel('Buscar turno').fill(receptor.nombres);
  await page.getByRole('button', { name: `Ver turno de ${nombreCompleto(receptor)}` }).first().click();
  const ficha = page.getByRole('dialog');
  await expect(ficha).toContainText(nombreCompleto(receptor));
  await expect(ficha).toContainText('Riego por la toma norte (prueba E2E)');
  await ficha.getByRole('button', { name: /Editar/ }).click();

  const edicion = page.getByRole('dialog');
  await edicion.locator('#edit-dia').selectOption({ label: 'Jueves' });
  await edicion.locator('#edit-inicio').fill('10:00');
  await edicion.locator('#edit-fin').fill('09:00');
  await edicion.getByRole('button', { name: /Guardar/ }).click();
  await expect(aviso(page, 'La hora de fin debe ser mayor a la hora de inicio.')).toBeVisible();

  await edicion.locator('#edit-fin').fill('12:00');
  await edicion.getByRole('button', { name: /Guardar/ }).click();
  await expect(aviso(page, /Turno actualizado|actualizado/i)).toBeVisible();

  const fila = page.locator('tbody tr').filter({ hasText: 'Jueves' });
  await expect(fila).toContainText('10:00');
  await expect(fila).toContainText('12:00');
});

test('el turno se ve en el calendario semanal y en el cronograma por sectores', async ({ page }) => {
  const { receptor, sector } = leerEstado();
  await page.goto('/admin/turnos');

  await page.getByRole('tab', { name: 'Calendario semanal' }).click();
  await expect(page.getByText(receptor.nombres).first()).toBeVisible();

  await page.getByRole('tab', { name: 'Cronograma por sectores' }).click();
  await expect(page.getByText(sector).locator('visible=true').first()).toBeVisible();
  await expect(page.getByText(receptor.nombres).locator('visible=true').first()).toBeVisible();

  await page.getByRole('tab', { name: 'Tabla' }).click();
  await expect(page.locator('tbody tr').first()).toBeVisible();
});

test('la tabla de turnos filtra por sector, día y texto', async ({ page }) => {
  const { receptor, sector } = leerEstado();
  await page.goto('/admin/turnos');

  await page.getByLabel('Sector', { exact: true }).selectOption({ label: sector });
  const filas = page.locator('tbody tr');
  await expect(filas).toHaveCount(2);
  await expect(filas.first()).toContainText(receptor.nombres);

  await page.getByLabel('Día', { exact: true }).selectOption({ label: 'Jueves' });
  await expect(filas).toHaveCount(1);
  await page.getByLabel('Día', { exact: true }).selectOption({ label: 'Lunes' });
  await expect(page.getByText(/Sin coincidencias|No hay turnos/i).first()).toBeVisible();
});

test('eliminar un turno pide confirmación y lo quita de la lista', async ({ page }) => {
  const { receptor } = leerEstado();
  await page.goto('/admin/turnos');
  await page.getByLabel('Buscar turno').fill(receptor.nombres);
  await expect(page.locator('tbody tr')).toHaveCount(2);

  await page.getByRole('button', { name: `Eliminar turno de ${nombreCompleto(receptor)}` }).first().click();
  await dialogo(page).getByRole('button', { name: 'Cancelar' }).click();
  await expect(page.locator('tbody tr')).toHaveCount(2);

  await page.getByRole('button', { name: `Eliminar turno de ${nombreCompleto(receptor)}` }).first().click();
  await dialogo(page).getByRole('button', { name: 'Eliminar' }).click();
  await expect(aviso(page, /Turno eliminado|eliminado/i)).toBeVisible();
  await expect(page.locator('tbody tr')).toHaveCount(1);
});
