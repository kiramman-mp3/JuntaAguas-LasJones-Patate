const { test, expect } = require('@playwright/test');
const { descargarPdf } = require('./ayudas');

// Portal público: lo ve cualquier persona sin iniciar sesión.
test.use({ storageState: { cookies: [], origins: [] } });

test('el inicio presenta la Junta, sus cifras y las próximas convocatorias', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Gestión del Agua de Riego y Servicios Comunitarios', level: 1 })).toBeVisible();
  await expect(page.getByText('Usuarios activos')).toBeVisible();
  await expect(page.getByText('Caudal Total')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Próximas Mingas y Asambleas' })).toBeVisible();
  // Las convocatorias son públicas, pero no exponen datos de personas.
  await expect(page.getByText(/Hora de inicio: \d{2}:\d{2}/).first()).toBeVisible();
  await expect(page.getByText(/Punto de encuentro|Casa comunal/).first()).toBeVisible();
  await expect(page.locator('body')).not.toContainText(/\b\d{10}\b/);
});

test('el tablón de eventos lista asambleas con su multa y la convocatoria oficial en PDF', async ({ page }) => {
  await page.goto('/eventos');
  await expect(page.getByRole('heading', { name: 'Tablón de Asambleas y Mingas' })).toBeVisible();
  await expect(page.getByText(/Multa: \$\d+\.\d{2}/).first()).toBeVisible();
  const boton = page.getByRole('button', { name: /Ver Convocatoria (Oficial|Firmada) \(PDF\)/ }).first();
  await expect(boton).toBeVisible();

  // Sin sesión se genera la convocatoria en el navegador y se descarga como PDF.
  const { nombre, contenido } = await descargarPdf(page, () => boton.click());
  expect(nombre).toMatch(/\.pdf$/);
  expect(contenido.length).toBeGreaterThan(1000);
});

test('la página de información muestra misión, visión, directiva y sectores', async ({ page }) => {
  await page.goto('/informacion');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('La Jones');
  for (const titulo of ['Misión', 'Visión', 'Directiva', 'Sectores de riego', 'Contacto y atención']) {
    await expect(page.getByRole('heading', { name: titulo })).toBeVisible();
  }
  await expect(page.getByText(/\d+ lotes/).first()).toBeVisible();
});

test('la navegación principal recorre las páginas públicas', async ({ page }) => {
  await page.goto('/');
  const menu = page.getByRole('navigation', { name: 'Navegación principal' });
  await menu.getByRole('link', { name: 'Eventos y Actas' }).click();
  await expect(page).toHaveURL(/\/eventos$/);
  await menu.getByRole('link', { name: 'Información de la Junta' }).click();
  await expect(page).toHaveURL(/\/informacion$/);
  await menu.getByRole('link', { name: 'Inicio', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await menu.getByRole('link', { name: 'Iniciar Sesión' }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test('una dirección inexistente muestra la página 404 con salidas útiles', async ({ page }) => {
  await page.goto('/esta-ruta-no-existe');
  await expect(page.getByRole('heading', { name: 'Página no encontrada' })).toBeVisible();
  await page.getByRole('link', { name: 'Ver Eventos' }).click();
  await expect(page).toHaveURL(/\/eventos$/);
  await page.goBack();
  await page.getByRole('link', { name: 'Ir al Inicio' }).click();
  await expect(page).toHaveURL(/\/$/);
});

test('las rutas protegidas piden iniciar sesión y recuerdan a dónde volver', async ({ page }) => {
  for (const ruta of ['/admin/dashboard', '/admin/cobros/cobrar', '/mi-cuenta']) {
    await page.goto(ruta);
    await expect(page).toHaveURL(/\/login\?returnUrl=/);
    await expect(page.getByRole('button', { name: 'Ingresar al Sistema' })).toBeVisible();
  }
});

test('la API rechaza las consultas privadas sin sesión', async ({ request }) => {
  for (const ruta of ['/api/personas', '/api/financiero/pagos', '/api/auditoria', '/api/inventario']) {
    const r = await request.get(ruta);
    expect(r.status(), ruta).toBe(401);
  }
  const salud = await request.get('/api/health');
  expect(salud.ok()).toBeTruthy();
});
