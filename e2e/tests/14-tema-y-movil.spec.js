const { test, expect } = require('@playwright/test');
const { credenciales } = require('./ayudas');

// Apariencia: tema claro/oscuro y comportamiento en un teléfono (la directiva también cobra desde el móvil).
const VISTA_MOVIL = { width: 390, height: 844 };

test.describe('tema claro y oscuro', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('el modo oscuro se activa, se recuerda al recargar y se puede desactivar', async ({ page }) => {
    await page.goto('/');
    const html = page.locator('html');
    const claro = await html.getAttribute('data-theme');
    const alternar = page.getByRole('button', { name: /Activar modo (oscuro|claro)/ });

    await alternar.click();
    const cambiado = await html.getAttribute('data-theme');
    expect(cambiado).not.toBe(claro);
    await expect(alternar).toHaveAttribute('aria-pressed', cambiado === 'dark' ? 'true' : 'false');

    await page.reload();
    await expect(html).toHaveAttribute('data-theme', cambiado ?? '');

    await page.getByRole('button', { name: /Activar modo (oscuro|claro)/ }).click();
    await expect(html).toHaveAttribute('data-theme', claro ?? '');
  });

  test('el color de fondo cambia con el tema en las páginas públicas y en el login', async ({ page }) => {
    await page.goto('/login');
    const fondo = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    const antes = await fondo();
    await page.getByRole('button', { name: /Activar modo (oscuro|claro)/ }).click();
    await expect.poll(fondo).not.toBe(antes);
  });
});

test.describe('teléfono (390 px)', () => {
  test.use({ viewport: VISTA_MOVIL });

  test('las páginas públicas no desbordan la pantalla y el menú se abre', async ({ browser }) => {
    const contexto = await browser.newContext({ viewport: VISTA_MOVIL, baseURL: 'http://127.0.0.1:3210', storageState: { cookies: [], origins: [] } });
    const page = await contexto.newPage();
    for (const ruta of ['/', '/noticias', '/noticias/todas', '/eventos', '/informacion', '/login']) {
      await page.goto(ruta);
      const desborde = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(desborde, `${ruta} desborda horizontalmente`).toBeLessThanOrEqual(1);
    }
    await page.goto('/');
    const menu = page.getByRole('button', { name: 'Abrir menú de navegación' });
    await expect(menu).toBeVisible();
    await menu.click();
    await expect(menu).toHaveAttribute('aria-expanded', 'true');
    await page.getByRole('link', { name: 'Eventos y Actas' }).click();
    await expect(page).toHaveURL(/\/eventos$/);
  });

  test('el panel de la directiva usa la barra inferior y llega a todos los módulos', async ({ page }) => {
    await page.goto('/admin/dashboard');
    const barra = page.getByRole('navigation', { name: 'Secciones del panel' });
    await expect(barra).toBeVisible();
    for (const [nombre, url] of [['Usuarios', /\/admin\/usuarios/], ['Eventos', /\/admin\/asistencias/], ['Turnos', /\/admin\/turnos/], ['Inicio', /\/admin\/dashboard/]]) {
      await barra.getByRole('link', { name: nombre }).first().click();
      await expect(page).toHaveURL(url);
    }

    // "Más" reúne finanzas y gestión interna.
    await barra.getByRole('button', { name: 'Más' }).click();
    await page.getByRole('link', { name: 'Cobros y pagos' }).last().click();
    await expect(page).toHaveURL(/\/admin\/cobros\/cobrar/);
  });

  for (const ruta of ['/admin/dashboard', '/admin/usuarios/padron', '/admin/usuarios/lotes', '/admin/asistencias/asambleas', '/admin/asistencias/mingas', '/admin/turnos', '/admin/cobros/cobrar', '/admin/cobros/egresos', '/admin/ajustes/tarifas', '/admin/ajustes/facturacion', '/admin/historial/pagos', '/admin/historial/historial', '/admin/gestion/auditoria', '/admin/gestion/inventario', '/admin/gestion/plan-anual', '/admin/noticias']) {
    test(`${ruta} cabe en la pantalla del teléfono`, async ({ page }) => {
      await page.goto(ruta);
      await expect(page.locator('main')).toBeVisible();
      await page.waitForLoadState('networkidle');
      const desborde = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(desborde, `${ruta} desborda horizontalmente`).toBeLessThanOrEqual(1);
    });
  }

  test('cobrar desde el teléfono: buscar, elegir y ver el total', async ({ page }) => {
    await page.goto('/admin/cobros/cobrar');
    await page.getByLabel('Buscar usuario').fill(credenciales().usuario.cedula);
    await page.getByRole('list', { name: 'Usuarios encontrados' }).getByRole('button').first().click();
    await expect(page.getByRole('tab', { name: /Agua anual/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Registrar pago' })).toBeVisible();
  });
});
