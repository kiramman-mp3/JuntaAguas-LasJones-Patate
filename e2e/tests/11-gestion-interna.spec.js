const { test, expect } = require('@playwright/test');
const { unico, fechaEcuador, aviso } = require('./ayudas');

// Gestión interna de la directiva: inventario de bienes y plan anual de actividades.
test.describe.configure({ mode: 'serial' });

const BIEN = unico('Compuerta E2E');
const ANIO_PLAN = String(2040 + (Date.now() % 50)); // un año libre: no choca con el plan sembrado
const ACTIVIDAD = unico('Limpieza del reservorio E2E');

test.describe('inventario', () => {
  test('la pestaña de inventario lista los bienes sembrados con su total', async ({ page }) => {
    await page.goto('/admin/gestion/inventario');
    await expect(page.getByRole('heading', { name: 'Inventario de bienes' })).toBeVisible();
    const filas = page.locator('tbody tr');
    await expect(filas.first()).toBeVisible();
    // Total = cantidad × valor unitario en cada fila.
    const celdas = await filas.first().locator('td').allInnerTexts();
    const cantidad = Number(celdas[2]);
    const unitario = Number(celdas[3].replace(/[^\d.]/g, ''));
    const total = Number(celdas[4].replace(/[^\d.]/g, ''));
    expect(total).toBeCloseTo(cantidad * unitario, 2);
  });

  test('registrar un bien valida el nombre, la cantidad y el valor', async ({ page }) => {
    await page.goto('/admin/gestion/inventario');
    await page.getByRole('button', { name: 'Registrar bien' }).click();
    const guardar = () => page.getByRole('button', { name: /Registrar|Guardar/ }).last().click();

    await page.locator('#bien-nombre').fill('a');
    await guardar();
    await expect(aviso(page, 'Indique el nombre del bien.')).toBeVisible();

    await page.locator('#bien-nombre').fill(BIEN);
    await page.locator('#bien-cantidad').fill('0');
    await guardar();
    await expect(aviso(page, 'La cantidad debe ser al menos 1.')).toBeVisible();

    await page.locator('#bien-cantidad').fill('3');
    await page.locator('#bien-valor').fill('-5');
    await guardar();
    await expect(aviso(page, 'El valor unitario no puede ser negativo.')).toBeVisible();
  });

  test('un bien válido queda en la lista con su valor total', async ({ page }) => {
    await page.goto('/admin/gestion/inventario');
    await page.getByRole('button', { name: 'Registrar bien' }).click();
    await page.locator('#bien-nombre').fill(BIEN);
    await page.locator('#bien-cantidad').fill('3');
    await page.locator('#bien-valor').fill('45.50');
    await page.locator('#bien-estado').selectOption({ index: 1 });
    await page.locator('#bien-fecha').fill(fechaEcuador(-30));
    await page.locator('#bien-ubicacion').fill('Bodega de la casa comunal');
    await page.locator('#bien-descripcion').fill('Compuerta metálica de repuesto (prueba E2E)');
    await page.getByRole('button', { name: /Registrar|Guardar/ }).last().click();
    await expect(aviso(page, /bien.*registrad|registrad/i)).toBeVisible();

    const fila = page.getByRole('row').filter({ hasText: BIEN });
    await expect(fila).toHaveCount(1);
    await expect(fila).toContainText('Bodega de la casa comunal');
    await expect(fila).toContainText('45.50');
    await expect(fila).toContainText('136.50'); // 3 × 45.50
    await expect(fila).toContainText(/Adquirido el/);
  });
});

test.describe('plan anual', () => {
  test('crear un plan lo muestra con su año y estado', async ({ page }) => {
    await page.goto('/admin/gestion/plan-anual');
    await page.getByRole('button', { name: 'Nuevo plan' }).click();
    await page.locator('#plan-anio').fill('1');
    await page.getByRole('button', { name: 'Crear plan' }).click();
    await expect(aviso(page, 'Indique un año válido.')).toBeVisible();

    await page.locator('#plan-anio').fill(ANIO_PLAN);
    await page.locator('#plan-descripcion').fill('Plan de prueba de extremo a extremo');
    await page.getByRole('button', { name: 'Crear plan' }).click();
    await expect(page.getByRole('heading', { name: new RegExp(`Plan ${ANIO_PLAN}`) })).toBeVisible();
    await expect(page.getByText('Plan de prueba de extremo a extremo')).toBeVisible();
  });

  test('no se puede crear dos planes para el mismo año', async ({ page }) => {
    await page.goto('/admin/gestion/plan-anual');
    await page.getByRole('button', { name: 'Nuevo plan' }).click();
    await page.locator('#plan-anio').fill(ANIO_PLAN);
    await page.getByRole('button', { name: 'Crear plan' }).click();
    await expect(page.locator('.toast--error, .toast--danger, .toast--warning').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: new RegExp(`Plan ${ANIO_PLAN}`) })).toHaveCount(1);
  });

  test('agregar actividades valida las fechas y las lista en el plan', async ({ page }) => {
    await page.goto('/admin/gestion/plan-anual');
    const plan = page.locator('article.card', { has: page.getByRole('heading', { name: new RegExp(`Plan ${ANIO_PLAN}`) }) });
    await plan.getByRole('button', { name: 'Actividad' }).click();

    await page.locator('#act-nombre').fill('ab');
    await page.locator('#act-inicio').fill(`${ANIO_PLAN}-03-01`);
    await page.locator('#act-fin').fill(`${ANIO_PLAN}-03-05`);
    await page.getByRole('button', { name: 'Agregar actividad' }).click();
    await expect(aviso(page, 'Describa la actividad (mínimo 3 caracteres).')).toBeVisible();

    await page.locator('#act-nombre').fill(ACTIVIDAD);
    await page.locator('#act-inicio').fill(`${ANIO_PLAN}-03-10`);
    await page.locator('#act-fin').fill(`${ANIO_PLAN}-03-05`);
    await page.getByRole('button', { name: 'Agregar actividad' }).click();
    await expect(aviso(page, 'La fecha de inicio debe ser anterior o igual a la de fin.')).toBeVisible();

    await page.locator('#act-fin').fill(`${ANIO_PLAN}-03-12`);
    await page.locator('#act-descripcion').fill('Retiro de sedimentos antes del verano');
    await page.getByRole('button', { name: 'Agregar actividad' }).click();

    const fila = plan.getByRole('row').filter({ hasText: ACTIVIDAD });
    await expect(fila).toHaveCount(1);
    await expect(fila).toContainText('Retiro de sedimentos antes del verano');
    await expect(fila).toContainText('10/03/' + ANIO_PLAN);
    await expect(fila).toContainText('12/03/' + ANIO_PLAN);
  });

  test('el plan vigente sembrado muestra sus actividades con su estado', async ({ page }) => {
    await page.goto('/admin/gestion/plan-anual');
    const anio = fechaEcuador(0).slice(0, 4);
    const plan = page.locator('article.card', { has: page.getByRole('heading', { name: new RegExp(`Plan ${anio}`) }) });
    await expect(plan).toBeVisible();
    await expect(plan.locator('tbody tr').first()).toBeVisible();
    await expect(plan.locator('.badge').first()).toBeVisible();
  });
});

test('las tres secciones de gestión interna se navegan desde la barra superior', async ({ page }) => {
  await page.goto('/admin/gestion');
  await expect(page).toHaveURL(/\/admin\/gestion\/auditoria/);
  await page.getByRole('link', { name: 'Inventario' }).first().click();
  await expect(page).toHaveURL(/\/admin\/gestion\/inventario/);
  await page.getByRole('link', { name: 'Plan anual' }).first().click();
  await expect(page).toHaveURL(/\/admin\/gestion\/plan-anual/);
  await page.getByRole('link', { name: 'Auditoría' }).first().click();
  await expect(page).toHaveURL(/\/admin\/gestion\/auditoria/);
});
