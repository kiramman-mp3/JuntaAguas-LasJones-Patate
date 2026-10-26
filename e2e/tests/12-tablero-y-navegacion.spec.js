const { test, expect } = require('@playwright/test');
const { crearUsuarioConCuenta, iniciarSesion } = require('./ayudas');

// El tablero de la directiva resume el estado de la Junta, y su menú lleva a cada módulo.
const dinero = (texto) => Number(texto.replace(/[^\d.-]/g, ''));
const valorDe = async (page, nombre) =>
  dinero(await page.locator('.stat-tile', { hasText: nombre }).locator('.stat-tile__value').first().innerText());

test('el tablero muestra los cuatro indicadores financieros con importes válidos', async ({ page }) => {
  await page.goto('/admin/dashboard');
  await expect(page.getByRole('heading', { name: 'Resumen de la Junta' })).toBeVisible();
  for (const nombre of ['Recaudado este mes', 'Pendiente por cobrar', 'Egresos este mes', 'Saldo de caja']) {
    const tile = page.locator('.stat-tile', { hasText: nombre });
    await expect(tile).toBeVisible();
    await expect(tile.locator('.stat-tile__value')).toHaveText(/^-?\$[\d,]+\.\d{2}$/);
  }
});

test('los indicadores del tablero coinciden con los de Cobros y pagos', async ({ page }) => {
  await page.goto('/admin/dashboard');
  const tablero = {
    saldo: await valorDe(page, 'Saldo de caja'),
    cartera: await valorDe(page, 'Pendiente por cobrar'),
    egresos: await valorDe(page, 'Egresos este mes'),
    recaudado: await valorDe(page, 'Recaudado este mes')
  };

  await page.goto('/admin/cobros/cobrar');
  expect(await valorDe(page, 'Saldo de caja')).toBeCloseTo(tablero.saldo, 2);
  expect(await valorDe(page, 'Por cobrar')).toBeCloseTo(tablero.cartera, 2);
  expect(await valorDe(page, 'Cobrado este mes')).toBeCloseTo(tablero.recaudado, 2);
  const egresosMes = await page.locator('.stat-tile', { hasText: 'Cobrado este mes' }).innerText();
  expect(dinero(egresosMes.match(/Egresos del mes: (\$[\d.]+)/)[1])).toBeCloseTo(tablero.egresos, 2);
});

test('el resumen operativo concuerda con lo que ve el público', async ({ page, browser }) => {
  await page.goto('/admin/dashboard');
  const activos = await page.locator('.metric-list div', { hasText: 'Usuarios activos' }).locator('dd').innerText();
  expect(Number(activos)).toBeGreaterThan(100);
  await expect(page.locator('.metric-list div', { hasText: 'Turnos de riego activos' }).locator('dd')).toHaveText(/^\d+$/);
  await expect(page.locator('.metric-list div', { hasText: 'Cobro del pago anual de agua' }).locator('dd')).toHaveText(/^\s*(\d+%|—)\s*$/);

  const publico = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const anonima = await publico.newPage();
  await anonima.goto('http://127.0.0.1:3210/');
  const textoInicio = await anonima.locator('body').innerText();
  expect(Number(textoInicio.match(/Usuarios activos\s*(\d+)/)[1])).toBe(Number(activos));
  await publico.close();
});

test('Actualizar indicadores vuelve a consultar el resumen', async ({ page }) => {
  await page.goto('/admin/dashboard');
  await expect(page.locator('.stat-tile').first()).toBeVisible();
  const [respuesta] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/dashboard/resumen')),
    page.getByRole('button', { name: 'Actualizar indicadores' }).click()
  ]);
  expect(respuesta.status()).toBe(200);
});

test('los próximos eventos enlazan con Asistencias', async ({ page }) => {
  await page.goto('/admin/dashboard');
  const lista = page.locator('.event-list__item');
  await expect(lista.first()).toBeVisible();
  await expect(lista.first().locator('.pill')).toHaveText(/Asamblea|Minga/);
  await page.getByRole('link', { name: 'Ver todos' }).click();
  await expect(page).toHaveURL(/\/admin\/asistencias/);
});

test.describe('acciones rápidas', () => {
  test('Registrar cobro lleva a la caja', async ({ page }) => {
    await page.goto('/admin/dashboard');
    await page.getByRole('link', { name: /Registrar cobro/ }).click();
    await expect(page).toHaveURL(/\/admin\/cobros\/cobrar/);
    await expect(page.getByLabel('Buscar usuario')).toBeVisible();
  });

  test('Registrar egreso abre el formulario de egreso', async ({ page }) => {
    await page.goto('/admin/dashboard');
    await page.getByRole('link', { name: /Registrar egreso/ }).click();
    await expect(page).toHaveURL(/\/admin\/cobros\/egresos/);
    await expect(page.locator('#egreso-concepto')).toBeVisible();
  });

  test('Registrar usuario abre el formulario de alta', async ({ page }) => {
    await page.goto('/admin/dashboard');
    await page.getByRole('link', { name: /Registrar usuario/ }).click();
    await expect(page).toHaveURL(/\/admin\/usuarios\/padron/);
    await expect(page.getByLabel('Cédula *')).toBeVisible();
  });

  test('Asignar turno de agua lleva a los turnos', async ({ page }) => {
    await page.goto('/admin/dashboard');
    await page.getByRole('link', { name: /Asignar turno de agua/ }).click();
    await expect(page).toHaveURL(/\/admin\/turnos/);
  });
});

test.describe('menú del panel', () => {
  const destinos = [
    ['Gestión de Usuarios', /\/admin\/usuarios\/padron/],
    ['Asistencias', /\/admin\/asistencias\/asambleas/],
    ['Turnos de agua', /\/admin\/turnos/],
    ['Cobros y pagos', /\/admin\/cobros\/cobrar/],
    ['Ajustes', /\/admin\/ajustes\/tarifas/],
    ['Historial', /\/admin\/historial\/pagos/],
    ['Gestión interna', /\/admin\/gestion\/auditoria/],
    ['Dashboard', /\/admin\/dashboard/]
  ];

  test('cada apartado del menú abre su módulo y se marca como página actual', async ({ page }) => {
    await page.goto('/admin/dashboard');
    const menu = page.getByRole('navigation', { name: 'Secciones del panel' });
    for (const [nombre, url] of destinos) {
      const enlace = menu.getByRole('link', { name: nombre }).first();
      await enlace.click();
      await expect(page).toHaveURL(url);
      await expect(enlace).toHaveAttribute('aria-current', 'page');
    }
  });

  test('una ruta inexistente del panel regresa al tablero', async ({ page }) => {
    await page.goto('/admin/no-existe');
    await expect(page).toHaveURL(/\/admin\/dashboard/);
  });

  test('el panel indica que el sistema está en línea', async ({ page }) => {
    await page.goto('/admin/dashboard');
    await expect(page.getByText('Sistema en línea')).toBeVisible();
  });

  // Cerrar sesión revoca todos los tokens de la cuenta: se usa un administrador propio para no tumbar la sesión compartida.
  test.describe('cierre de sesión', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test('cerrar sesión desde el encabezado cierra el panel y vuelve a pedir credenciales', async ({ page, request }) => {
      const admin = await crearUsuarioConCuenta(request, { rol: 'ADMIN' });
      await iniciarSesion(page, { cedula: admin.cedula, password: admin.passwordTemporal });
      await page.getByLabel('Nueva Contraseña').fill('ClaveAdmin2026x');
      await page.getByLabel('Confirmar Contraseña').fill('ClaveAdmin2026x');
      await page.getByRole('button', { name: 'Cambiar Contraseña' }).click();
      await expect(page).toHaveURL(new RegExp('/admin'));

      await page.getByRole('button', { name: 'Cerrar Sesión' }).first().click();
      await page.goto('/admin/dashboard');
      await expect(page).toHaveURL(new RegExp('/login'));
    });
  });
});
