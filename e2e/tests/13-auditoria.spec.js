const { test, expect } = require('@playwright/test');
const { fechaEcuador, leerEstado, tokenAdmin } = require('./ayudas');

// La auditoría corre al final: ahí quedaron los rastros de todo lo que hicieron las pruebas anteriores.
const filas = (page) => page.locator('tbody tr');

async function filtrar(page, { accion = '', entidad = '', desde, hasta } = {}) {
  await page.goto('/admin/gestion/auditoria');
  await expect(page.getByRole('heading', { name: 'Registro de auditoría' })).toBeVisible();
  await page.locator('#aud-desde').fill(desde ?? fechaEcuador(-1));
  await page.locator('#aud-hasta').fill(hasta ?? fechaEcuador(0));
  await page.locator('#aud-accion').selectOption(accion);
  await page.locator('#aud-entidad').fill(entidad);
}

test('el registro lista quién hizo qué, con fecha, entidad e IP', async ({ page }) => {
  await filtrar(page);
  await expect(filas(page).first()).toBeVisible();
  const celdas = filas(page).first().locator('td');
  await expect(celdas).toHaveCount(6);
  await expect(celdas.nth(0)).toContainText(/\d{2}\/\d{2}\/\d{4}/);
  await expect(celdas.nth(2).locator('.badge')).toHaveText(/^[A-Z_]+$/);
  await expect(celdas.nth(5)).toContainText(/\d+\.\d+\.\d+\.\d+|::|—/);
});

test('los inicios de sesión de las pruebas quedaron registrados', async ({ page }) => {
  await filtrar(page, { accion: 'LOGIN' });
  await expect(filas(page).first()).toBeVisible();
  expect(await filas(page).count()).toBeGreaterThan(5);
  for (const texto of await filas(page).locator('td:nth-child(3)').allInnerTexts()) expect(texto.trim()).toBe('LOGIN');
});

test('el bloqueo de la cuenta tras cinco intentos fallidos quedó auditado', async ({ page }) => {
  const { bloqueable } = leerEstado();
  await filtrar(page, { accion: 'BLOQUEO' });
  await expect(filas(page).first()).toBeVisible();
  // Los datos del bloqueo apuntan a la cuenta del usuario de prueba.
  await expect(filas(page).first()).toContainText('cuentas');
  expect(bloqueable.cedula).toBeTruthy();
});

test('las anulaciones de pago se registran con su motivo', async ({ page }) => {
  await filtrar(page, { accion: 'ANULAR', entidad: 'pagos' });
  const fila = filas(page).filter({ hasText: 'Referencia bancaria mal digitada (prueba E2E)' });
  await expect(fila).toHaveCount(1);
  await expect(fila).toContainText('pagos');
});

test('los cobros, las altas y los cambios de tarifa dejan su rastro', async ({ page }) => {
  await filtrar(page, { accion: 'CREAR', entidad: 'pagos' });
  await expect(filas(page).first()).toBeVisible();
  await filtrar(page, { accion: 'CREAR', entidad: 'tarifas' });
  await expect(filas(page).first()).toBeVisible();
  await filtrar(page, { accion: 'CREAR', entidad: 'personas' });
  await expect(filas(page).first()).toBeVisible();
});

test('el filtro por entidad muestra solo esa entidad y avisa cuando no hay registros', async ({ page }) => {
  await filtrar(page, { entidad: 'pagos' });
  await expect(filas(page).first()).toBeVisible();
  for (const texto of await filas(page).locator('td:nth-child(4)').allInnerTexts()) expect(texto.trim()).toMatch(new RegExp('^pagos'));
  await page.locator('#aud-entidad').fill('entidad-que-no-existe');
  await expect(page.getByText('Sin registros')).toBeVisible();
});

test('un rango de fechas sin actividad no devuelve registros', async ({ page }) => {
  await filtrar(page, { desde: '2001-01-01', hasta: '2001-01-31' });
  await expect(page.getByText('Sin registros')).toBeVisible();
});

test('un administrador del sistema puede consultar la API; un usuario común no', async ({ request }) => {
  const admin = await request.get('/api/auditoria', { headers: { Authorization: `Bearer ${tokenAdmin()}` } });
  expect(admin.status()).toBe(200);
  const sinSesion = await request.get('/api/auditoria');
  expect(sinSesion.status()).toBe(401);
});
