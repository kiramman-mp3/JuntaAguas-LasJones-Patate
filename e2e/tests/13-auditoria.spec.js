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
  // La entidad se aplica al pulsar Enter (o al salir del campo); las demás, al cambiar.
  await Promise.all([page.waitForResponse((r) => r.url().includes('/api/auditoria')), page.locator('#aud-entidad').press('Enter')]);
}

/** Todas las filas visibles cumplen el filtro (la tabla ya se volvió a consultar). */
async function soloFilas(page, { accion, entidad }) {
  if (accion) await expect(filas(page).filter({ hasNotText: accion })).toHaveCount(0);
  if (entidad) await expect(filas(page).filter({ hasNotText: entidad })).toHaveCount(0);
  await expect(filas(page).first()).toBeVisible();
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
  await soloFilas(page, { accion: 'LOGIN' });
  expect(await filas(page).count()).toBeGreaterThan(5);
});

test('el bloqueo de la cuenta tras cinco intentos fallidos quedó auditado', async ({ page }) => {
  const { bloqueable } = leerEstado();
  await filtrar(page, { accion: 'BLOQUEO' });
  await soloFilas(page, { accion: 'BLOQUEO', entidad: 'cuentas' });
  expect(bloqueable.cedula).toBeTruthy();
});

test('las anulaciones de pago se registran con su motivo', async ({ page }) => {
  await filtrar(page, { accion: 'ANULAR', entidad: 'pagos' });
  await soloFilas(page, { accion: 'ANULAR', entidad: 'pagos' });
  const fila = filas(page).filter({ hasText: 'Referencia bancaria mal digitada (prueba E2E)' });
  await expect(fila).toHaveCount(1);
  await expect(fila).toContainText('pagos');
});

test('cada operación importante dejó su rastro: cobros, altas, tarifas, egresos, lotes, eventos e inventario', async ({ page }) => {
  const rastros = [
    ['PAGO', 'pagos'], ['PAGO', 'pago_anual_agua'], ['CREAR', 'tarifas'], ['CREAR', 'personas'], ['CREAR', 'egresos'],
    ['CREAR', 'sectores'], ['CREAR', 'lotes'], ['CREAR', 'eventos'], ['CREAR', 'bienes_inventario'], ['CREAR', 'planes_anuales'],
    ['CREAR', 'obligacion_anual_agua'], ['MODIFICAR', 'pagos']
  ];
  for (const [accion, entidad] of rastros) {
    await filtrar(page, { accion, entidad });
    await soloFilas(page, { accion, entidad });
  }
});

test('el filtro por entidad muestra solo esa entidad y avisa cuando no hay registros', async ({ page }) => {
  await filtrar(page, { entidad: 'pagos' });
  await soloFilas(page, { entidad: 'pagos' });
  await page.locator('#aud-entidad').fill('entidad-que-no-existe');
  await page.locator('#aud-entidad').press('Enter');
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
