const { test, expect } = require('@playwright/test');
const { credenciales, iniciarSesion, crearObligacionManual, personaIdPorCedula, fechaEcuador, descargarPdf, tokenAdmin } = require('./ayudas');

// El usuario consulta su propia cuenta; lo que cobra el administrador aparece en su portal.
test.describe.configure({ mode: 'serial' });

const OBSERVACION = `Reposición de candado E2E ${Date.now().toString(36)}`;
const VALOR = 12;

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.print = () => {};
  });
});

test.describe('lo que ve el usuario', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('una obligación nueva aparece como saldo pendiente en su cuenta', async ({ page, request }) => {
    const { usuario, password } = credenciales();
    const personaId = await personaIdPorCedula(request, usuario.cedula);
    await crearObligacionManual(request, { personaId, valor: VALOR, observacion: OBSERVACION });

    await iniciarSesion(page, { cedula: usuario.cedula, password });
    await expect(page).toHaveURL(/\/mi-cuenta/);
    await expect(page.getByRole('heading', { name: usuario.nombre })).toBeVisible();
    await expect(page.getByText('Total Saldo Pendiente a Cancelar')).toBeVisible();
    await expect(page.getByText('VALORES PENDIENTES', { exact: true })).toBeVisible();
    const pendiente = page.getByRole('row').filter({ hasText: 'PENDIENTE' });
    await expect(pendiente).toContainText('$' + VALOR + '.00');
    await expect(pendiente).toContainText('Multa por Inasistencia');
    await expect(page.getByText('AL DÍA EN PAGOS')).toHaveCount(0);
  });

  test('solo se ven los datos propios: la API no entrega los de otra persona', async ({ page, request }) => {
    const { usuario, password } = credenciales();
    await iniciarSesion(page, { cedula: usuario.cedula, password });
    await expect(page).toHaveURL(/\/mi-cuenta/);
    const token = await page.evaluate(() => localStorage.getItem('junta_token') ?? sessionStorage.getItem('junta_token'));
    const cabeceras = { Authorization: `Bearer ${token}` };

    const propias = await request.get('/api/financiero/obligaciones', { headers: cabeceras });
    expect(propias.status()).toBe(200);
    const { data } = await propias.json();
    expect(data.length).toBeGreaterThan(0);
    expect(new Set(data.map((o) => o.persona_id)).size).toBe(1);

    // Intentar consultar a otra persona por la cédula se ignora o se rechaza, nunca se obedece.
    const ajena = await request.get('/api/financiero/obligaciones?cedula=1800000000', { headers: cabeceras });
    if (ajena.ok()) {
      const otra = (await ajena.json()).data;
      expect(new Set(otra.map((o) => o.persona_id))).toEqual(new Set(data.map((o) => o.persona_id)));
    } else {
      expect([400, 403]).toContain(ajena.status());
    }
    // Sus pagos son solo los suyos y el recibo de otra persona no existe para él.
    const miId = data[0].persona_id;
    const pagos = await request.get('/api/financiero/pagos', { headers: cabeceras });
    expect(pagos.status()).toBe(200);
    const mios = (await pagos.json()).data;
    expect(mios.every((p) => p.persona_id === miId)).toBeTruthy();

    const todos = await request.get('/api/financiero/pagos', { headers: { Authorization: `Bearer ${tokenAdmin()}` }, params: { desde: '2000-01-01', hasta: fechaEcuador(1) } });
    const ajeno = (await todos.json()).data.find((p) => p.persona_id !== miId);
    expect(ajeno, 'debe haber pagos de otras personas').toBeTruthy();
    const detalle = await request.get(`/api/financiero/pagos/${ajeno.id}`, { headers: cabeceras });
    expect(detalle.status()).toBe(404);
  });
});

test.describe('el administrador cobra y el usuario lo ve', () => {
  test('cobrar la obligación en caja registra el pago', async ({ page }) => {
    const { usuario } = credenciales();
    await page.goto('/admin/cobros/cobrar');
    await page.getByLabel('Buscar usuario').fill(usuario.cedula);
    await page.getByRole('list', { name: 'Usuarios encontrados' }).getByRole('button').first().click();
    await page.getByRole('tab', { name: /Multas y otros/ }).click();
    const arbol = page.getByRole('list', { name: 'Obligaciones pendientes por año y mes' });
    for (let i = 0; i < 4; i += 1) {
      const cerrados = arbol.locator('button[aria-expanded="false"]');
      if (!(await cerrados.count())) break;
      await cerrados.first().click();
    }
    await expect(arbol).toContainText(OBSERVACION);
    await page.getByLabel(`Seleccionar todo ${fechaEcuador(0).slice(0, 4)}`).check();
    await page.getByRole('radio', { name: 'Transferencia' }).click();
    await page.getByLabel('Número de referencia').fill(`E2E-CUENTA-${Date.now()}`);
    await page.getByRole('button', { name: 'Registrar pago' }).click();
    await expect(page.locator('strong', { hasText: /Pago .+ registrado/ })).toBeVisible();
  });
});

test.describe('después del cobro', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('la cuenta queda al día y el comprobante se puede imprimir y descargar', async ({ page }) => {
    const { usuario, password } = credenciales();
    await iniciarSesion(page, { cedula: usuario.cedula, password });
    await expect(page).toHaveURL(/\/mi-cuenta/);
    await expect(page.getByText('AL DÍA EN PAGOS')).toBeVisible();
    await expect(page.getByText('¡Felicitaciones! No registras valores pendientes.')).toBeVisible();
    // La obligación cobrada pasa al historial de cuentas pagadas.
    const pagada = page.getByRole('row').filter({ hasText: 'PAGADA' }).filter({ hasText: 'Multa por Inasistencia a Asamblea' });
    await expect(pagada.first()).toContainText('$' + VALOR + '.00');

    const fila = page.getByRole('row').filter({ hasText: /Ref: E2E-CUENTA/ });
    await expect(fila).toHaveCount(1);
    const { nombre } = await descargarPdf(page, () => fila.getByRole('button', { name: /^PDF/ }).click());
    expect(nombre).toMatch(new RegExp('^REC-.*[.]pdf$'));

    // Imprimir abre el comprobante sin salir de la página.
    await fila.getByRole('button', { name: /Imprimir comprobante/ }).click();
    await expect(page).toHaveURL(/\/mi-cuenta/);
  });

  test('cerrar sesión desde Mi cuenta termina la sesión', async ({ page }) => {
    const { usuario, password } = credenciales();
    await iniciarSesion(page, { cedula: usuario.cedula, password });
    await expect(page).toHaveURL(/\/mi-cuenta/);
    await page.getByRole('button', { name: 'Cerrar Sesión' }).first().click();
    await page.goto('/mi-cuenta');
    await expect(page).toHaveURL(/\/login/);
  });
});
