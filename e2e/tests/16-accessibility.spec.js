const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const { credenciales, iniciarSesion } = require('./ayudas');

// Accesibilidad automática (axe-core, WCAG 2.x A/AA) en las pantallas clave y en los dos temas.
// Falla ante cualquier problema serio o crítico; los moderados/menores se listan pero no bloquean.
const SIN_SESION = { cookies: [], origins: [] };
const TEMAS = ['light', 'dark'];

/**
 * Espera a que la pantalla termine de cargar y de animarse. Las tarjetas y listas del panel aparecen con un
 * fundido; si axe mide el contraste a mitad de ese fundido, el color mezclado con el fondo parece de bajo
 * contraste. En una máquina lenta (CI) el análisis llega antes de que termine y falla de forma intermitente.
 */
async function esperarPantallaEstable(page) {
  await page.waitForLoadState('networkidle');
  await expect(page.locator('.skeleton')).toHaveCount(0);
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))));
}

async function revisar(page, ruta, tema) {
  // Con "reducir movimiento" las animaciones de la aplicación terminan al instante.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript((t) => {
    try {
      localStorage.setItem('junta_theme', t);
    } catch {
      /* sin almacenamiento: se usa el tema por defecto */
    }
  }, tema);
  await page.goto(ruta);
  await expect(page.locator('h1').first()).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', tema);
  await esperarPantallaEstable(page);
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const graves = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  const resumen = graves.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} nodo(s), p. ej. ${v.nodes[0].target.join(' ')}`);
  expect(resumen, `${ruta} [${tema}]`).toEqual([]);
}

test.describe('páginas públicas', () => {
  test.use({ storageState: SIN_SESION });

  for (const tema of TEMAS) {
    for (const ruta of ['/', '/noticias', '/noticias/todas', '/eventos', '/informacion', '/login']) {
      test(`${ruta} cumple WCAG AA en tema ${tema}`, async ({ page }) => {
        await revisar(page, ruta, tema);
      });
    }
  }

  test('cada pantalla tiene un solo <main> y un solo <h1>', async ({ page }) => {
    for (const ruta of ['/', '/noticias', '/eventos', '/informacion', '/login']) {
      await page.goto(ruta);
      await expect(page.locator('h1').first()).toBeVisible();
      await expect(page.locator('main'), ruta).toHaveCount(1);
      await expect(page.locator('h1:visible'), ruta).toHaveCount(1);
    }
  });

  test('/noticias no salta niveles de encabezado', async ({ page }) => {
    await page.goto('/noticias');
    await expect(page.locator('h1').first()).toBeVisible();
    const { violations } = await new AxeBuilder({ page }).withRules(['heading-order']).analyze();
    expect(violations.map((v) => v.id)).toEqual([]);
  });

  test('el enlace "Saltar al contenido" lleva el foco al contenido sin cambiar la URL', async ({ page }) => {
    await page.goto('/noticias');
    const url = page.url();
    await page.keyboard.press('Tab');
    const salto = page.getByRole('link', { name: 'Saltar al contenido' });
    await expect(salto).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('main#contenido')).toBeFocused();
    expect(page.url()).toBe(url);
  });
});

test.describe('portal del usuario', () => {
  test.use({ storageState: SIN_SESION });

  for (const tema of TEMAS) {
    test(`/mi-cuenta cumple WCAG AA en tema ${tema}`, async ({ page }) => {
      const { usuario, password } = credenciales();
      await iniciarSesion(page, { cedula: usuario.cedula, password });
      await expect(page).toHaveURL(/\/mi-cuenta/);
      await revisar(page, '/mi-cuenta', tema);
    });
  }
});

test.describe('panel de administración', () => {
  for (const tema of TEMAS) {
    for (const ruta of ['/admin/dashboard', '/admin/padron', '/admin/cobros/cobrar', '/admin/asistencias/asambleas', '/admin/turnos']) {
      test(`${ruta} cumple WCAG AA en tema ${tema}`, async ({ page }) => {
        await revisar(page, ruta, tema);
      });
    }
  }

  test('el panel tiene un solo <main> y un solo <h1>', async ({ page }) => {
    await page.goto('/admin/dashboard');
    await expect(page.locator('h1').first()).toBeVisible();
    await expect(page.locator('main')).toHaveCount(1);
    await expect(page.locator('h1:visible')).toHaveCount(1);
  });
});
