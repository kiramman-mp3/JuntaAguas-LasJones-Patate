const { test, expect } = require('@playwright/test');
const { unico, fechaEcuador, aviso, dialogo, leerEstado, guardarEstado, descargarPdf, fixture, credenciales } = require('./ayudas');

// Egresos, tarifas, pago anual de agua e historial: el dinero que entra y sale de la caja de la Junta.
test.describe.configure({ mode: 'serial' });

const CONCEPTO_EGRESO = unico('Tubería PVC E2E');
const FACTURA = `001-001-${String(Date.now()).slice(-9)}`;
const REFERENCIA_ANUAL = `E2E-AGUA-${Date.now()}`;

/** Valor numérico de un indicador de la parte superior de Cobros y pagos (p. ej. "Saldo de caja"). */
async function indicador(page, nombre) {
  const texto = await page.locator('.stat-tile', { hasText: nombre }).locator('.stat-tile__value').first().innerText();
  return Number(texto.replace(/[^\d.-]/g, ''));
}

// El navegador imprime con window.print(): en pruebas se anula para que no abra el diálogo del sistema.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.print = () => {};
  });
});

test.describe('egresos', () => {
  test('registrar un egreso lo agrega a la lista y descuenta el saldo de caja', async ({ page }) => {
    await page.goto('/admin/cobros/egresos');
    const saldoAntes = await indicador(page, 'Saldo de caja');
    await page.getByRole('button', { name: 'Registrar egreso' }).first().click();

    await page.locator('#egreso-fecha').fill(fechaEcuador(0));
    await page.locator('#egreso-valor').fill('37.50');
    await page.locator('#egreso-concepto').fill(CONCEPTO_EGRESO);
    await page.locator('#egreso-proveedor').fill('Ferretería La Esperanza');
    await page.locator('#egreso-factura').fill(FACTURA);
    await page.locator('#egreso-descripcion').fill('Compra para reparar la compuerta (prueba E2E).');
    await page.getByRole('button', { name: 'Registrar egreso' }).last().click();
    await expect(aviso(page, new RegExp('egreso.*registrad', 'i'))).toBeVisible();

    const fila = page.getByRole('row').filter({ hasText: CONCEPTO_EGRESO });
    await expect(fila).toHaveCount(1);
    await expect(fila).toContainText('Ferretería La Esperanza');
    await expect(fila).toContainText(FACTURA);
    await expect(fila).toContainText('37.50');

    await page.reload();
    expect(await indicador(page, 'Saldo de caja')).toBeCloseTo(saldoAntes - 37.5, 2);
  });

  test('el formulario no acepta un egreso incompleto ni con valor cero', async ({ page }) => {
    await page.goto('/admin/cobros/egresos');
    await page.getByRole('button', { name: 'Registrar egreso' }).first().click();
    await page.locator('#egreso-valor').fill('0');
    await page.getByRole('button', { name: 'Registrar egreso' }).last().click();
    await expect(page.locator('.toast--error, .toast--warning, .field__error, [role=alert]').first()).toBeVisible();
    await expect(page.locator('#egreso-concepto')).toBeVisible(); // el formulario sigue abierto
  });

  test('la lista de egresos se filtra por texto y por fechas, y el enlace ?nuevo=egreso abre el formulario', async ({ page }) => {
    await page.goto('/admin/cobros/egresos');
    await page.getByLabel('Buscar').fill(FACTURA);
    await expect(page.locator('tbody tr')).toHaveCount(1);
    await page.getByLabel('Buscar').fill('zzzz-no-existe');
    await expect(page.getByText('Sin egresos')).toBeVisible();

    await page.getByLabel('Buscar').fill('');
    await page.getByLabel('Hasta').fill('2020-01-01');
    await page.getByLabel('Desde').fill('2020-01-01');
    await expect(page.getByRole('row').filter({ hasText: CONCEPTO_EGRESO })).toHaveCount(0);

    await page.goto('/admin/cobros/egresos?nuevo=egreso');
    await expect(page.locator('#egreso-concepto')).toBeVisible();
    // Las direcciones antiguas siguen funcionando.
    await page.goto('/admin/finanzas/egresos');
    await expect(page).toHaveURL(/\/admin\/cobros\/egresos/);
  });
});

test.describe('tarifas', () => {
  test('una tarifa nueva se valida: valor, decimales y fecha posterior a la última', async ({ page }) => {
    await page.goto('/admin/ajustes/tarifas');
    await page.locator('.stat-tile', { hasText: 'Pago anual de agua' }).getByRole('button', { name: 'Cambiar tarifa' }).click();
    await page.locator('#tarifa-valor').fill('0');
    await page.getByRole('button', { name: /Registrar tarifa|Guardar/ }).last().click();
    await expect(page.getByText('Ingrese un valor mayor a cero.')).toBeVisible();

    await page.locator('#tarifa-valor').fill('12.345');
    await page.getByRole('button', { name: /Registrar tarifa|Guardar/ }).last().click();
    await expect(page.getByText('Use como máximo dos decimales.')).toBeVisible();

    await page.locator('#tarifa-valor').fill('12.50');
    await page.locator('#tarifa-desde').fill('2000-01-01');
    await page.getByRole('button', { name: /Registrar tarifa|Guardar/ }).last().click();
    await expect(page.getByText(/Debe ser posterior al/)).toBeVisible();
  });

  test('cambiar la multa de mingas la deja vigente hoy y la ve el formulario de nueva minga', async ({ page }) => {
    await page.goto('/admin/ajustes/tarifas');
    const tarjeta = page.locator('.stat-tile', { hasText: 'Multa por Inasistencia a Minga' });
    await tarjeta.getByRole('button', { name: 'Cambiar tarifa' }).click();
    await page.locator('#tarifa-valor').fill('25.00');
    await page.locator('#tarifa-desde').fill(fechaEcuador(0));
    await page.locator('#tarifa-observacion').fill('Aprobada en asamblea (prueba E2E)');
    await page.getByRole('button', { name: /Registrar tarifa|Guardar/ }).last().click();
    await expect(aviso(page, new RegExp('tarifa.*(registrad|creada|vigente)', 'i'))).toBeVisible();

    await expect(tarjeta).toContainText('$25.00');
    const historial = page.getByRole('region', { name: /Historial de Multa por Inasistencia a Minga/ });
    await expect(historial).toContainText('Aprobada en asamblea (prueba E2E)');
    await expect(historial.locator('.badge--success')).toContainText('Vigente');
    await expect(historial.locator('.badge').filter({ hasText: 'Histórica' }).first()).toBeVisible();

    // El formulario de nueva minga toma el valor desde Tarifas.
    await page.goto('/admin/asistencias/mingas');
    await page.getByRole('button', { name: 'Nueva minga' }).click();
    await expect(page.getByRole('dialog')).toContainText('$25.00');
  });

  test('una tarifa con fecha futura queda programada y no cambia el valor de hoy', async ({ page }) => {
    await page.goto('/admin/ajustes/tarifas');
    const tarjeta = page.locator('.stat-tile', { hasText: 'Multa por Inasistencia a Asamblea' });
    const antes = await tarjeta.locator('.stat-tile__value').innerText();
    await tarjeta.getByRole('button', { name: 'Cambiar tarifa' }).click();
    await page.locator('#tarifa-valor').fill('40.00');
    await page.locator('#tarifa-desde').fill(fechaEcuador(60));
    await page.getByRole('button', { name: /Registrar tarifa|Guardar/ }).last().click();
    await expect(aviso(page, new RegExp('tarifa.*(registrad|creada|vigente)', 'i'))).toBeVisible();

    await expect(tarjeta.locator('.stat-tile__value')).toHaveText(antes);
    const historial = page.getByRole('region', { name: /Historial de Multa por Inasistencia a Asamblea/ });
    await expect(historial.locator('.badge--info')).toContainText('Programada');
  });
});

test.describe('pago anual de agua', () => {
  test('la vista previa cuenta a los usuarios con lote que aún no tienen su obligación', async ({ page }) => {
    await page.goto('/admin/ajustes/facturacion');
    await expect(page.getByRole('heading', { name: /^Emitir \d{4}$/ })).toBeVisible();
    await expect(page.locator('.preview-card')).toContainText(/Se emitirán\s*\d+ obligaciones/);

    // Un valor propio cambia el total de la vista previa.
    await page.locator('#anual-valor').fill('55.00');
    await expect(page.locator('.preview-card')).toContainText('$55.00');
    await page.locator('#anual-valor').fill('');
    await expect(page.locator('.preview-card')).not.toContainText('$55.00');
  });

  test('emitir el año crea las obligaciones y deja el año al día', async ({ page }) => {
    await page.goto('/admin/ajustes/facturacion');
    const boton = page.getByRole('button', { name: /^Emitir \d+ obligaciones$/ });
    const cantidad = Number((await boton.innerText()).match(/\d+/)[0]);
    // Solo falta el usuario al que se le asignó el lote durante las pruebas anteriores.
    expect(cantidad).toBe(1);
    const resumenAntes = await page.locator('.summary__row', { hasText: 'Obligaciones emitidas' }).innerText();
    const emitidasAntes = Number(resumenAntes.match(/(\d+) ·/)[1]);

    await boton.click();
    await expect(dialogo(page)).toContainText('Vencen el 31 de diciembre');
    await dialogo(page).getByRole('button', { name: `Emitir ${cantidad} obligaciones` }).click();
    await expect(page.getByText('Año al día')).toBeVisible();
    await expect(page.locator('.summary__row', { hasText: 'Obligaciones emitidas' })).toContainText(`${emitidasAntes + cantidad} ·`);
  });

  test('el usuario con lote paga su año en caja y el recibo aparece en el historial', async ({ page }) => {
    const { receptor } = leerEstado();
    await page.goto('/admin/cobros/cobrar');
    await page.getByLabel('Buscar usuario').fill(receptor.cedula);
    await page.getByRole('list', { name: 'Usuarios encontrados' }).getByRole('button').first().click();
    await expect(page.getByRole('tab', { name: /Agua anual/ })).toBeVisible();
    await page.getByRole('list', { name: /Pago anual de agua pendiente/ }).getByRole('checkbox').first().check();
    await expect(page.locator('.summary__total')).not.toHaveText('$0.00');
    await page.getByRole('radio', { name: 'Depósito' }).click();
    await page.getByLabel('Número de referencia').fill(REFERENCIA_ANUAL);
    await page.getByRole('button', { name: 'Registrar pago' }).click();
    await expect(page.locator('strong', { hasText: /Pago .+ registrado/ })).toBeVisible();

    // El comprobante se puede descargar como PDF.
    const { nombre } = await descargarPdf(page, () => page.getByRole('button', { name: 'Descargar PDF' }).click());
    expect(nombre).toMatch(/\.pdf$/);

    const numero = (await page.locator('strong', { hasText: /Pago .+ registrado/ }).innerText()).match(/REC-[\w-]+/)[0];
    guardarEstado({ reciboAnual: numero });
    expect(numero).toContain('REC-AGUA');
  });
});

test.describe('historial', () => {
  test('el historial de recibos filtra por tipo y estado y muestra el recibo del pago anual', async ({ page }) => {
    const { receptor, reciboAnual } = leerEstado();
    await page.goto('/admin/historial/pagos');
    await page.getByLabel('Desde').fill(fechaEcuador(-1));
    await page.getByLabel('Buscar', { exact: true }).fill(receptor.cedula);
    const fila = page.getByRole('row').filter({ hasText: reciboAnual });
    await expect(fila).toHaveCount(1);
    await expect(fila).toContainText(new RegExp('Dep[oó]sito'));

    await page.getByLabel('Tipo').selectOption({ label: 'Multas y otros' });
    await expect(page.getByRole('row').filter({ hasText: reciboAnual })).toHaveCount(0);
    await page.getByLabel('Tipo').selectOption({ label: 'Pago anual de agua' });
    await expect(page.getByRole('row').filter({ hasText: reciboAnual })).toHaveCount(1);

    await page.getByLabel('Estado').selectOption({ label: 'Anulados' });
    await expect(page.getByRole('row').filter({ hasText: reciboAnual })).toHaveCount(0);
    await page.getByLabel('Estado').selectOption({ label: 'Vigentes' });
    await expect(page.getByRole('row').filter({ hasText: reciboAnual })).toHaveCount(1);
  });

  test('reimprimir pide el recibo al servidor; los pagos de agua no admiten comprobante bancario', async ({ page }) => {
    const { receptor, reciboAnual } = leerEstado();
    await page.goto('/admin/historial/pagos');
    await page.getByLabel('Desde').fill(fechaEcuador(-1));
    await page.getByLabel('Buscar', { exact: true }).fill(receptor.cedula);
    const fila = page.getByRole('row').filter({ hasText: reciboAnual });
    await expect(fila).toHaveCount(1);

    const [respuesta] = await Promise.all([
      page.waitForResponse((r) => new RegExp('/agua-anual/pagos/[0-9]+$').test(r.url()) && r.request().method() === 'GET'),
      fila.getByRole('button', { name: `Reimprimir comprobante ${reciboAnual}` }).click()
    ]);
    expect(respuesta.status()).toBe(200);
    // El comprobante bancario solo existe para los pagos de multas y otros rubros.
    await expect(fila.locator('input[type=file]')).toHaveCount(0);
  });

  test('el comprobante bancario de un pago de multas se adjunta en caja y queda en el historial', async ({ page }) => {
    const { usuario } = credenciales();
    await page.goto('/admin/cobros/cobrar');
    await page.getByLabel('Buscar usuario').fill(usuario.cedula);
    await page.getByRole('list', { name: 'Usuarios encontrados' }).getByRole('button').first().click();
    await page.getByRole('tab', { name: /Multas y otros/ }).click();
    await page.getByLabel(`Seleccionar todo ${fechaEcuador(0).slice(0, 4)}`).check();
    await page.getByRole('radio', { name: 'Transferencia' }).click();
    await page.getByLabel('Número de referencia').fill(`E2E-BANCO-${Date.now()}`);
    await page.getByRole('button', { name: 'Registrar pago' }).click();
    const titulo = page.locator('strong', { hasText: /Pago .+ registrado/ });
    await expect(titulo).toBeVisible();
    const numero = (await titulo.innerText()).match(/REC-[\w-]+/)[0];

    // Un archivo que no es PDF ni imagen se rechaza; un PDF se adjunta y se puede descargar.
    const archivo = page.locator('input[type=file]');
    await archivo.setInputFiles(fixture('no-es-pdf.txt'));
    await expect(aviso(page, 'Seleccione un PDF, JPG o PNG')).toBeVisible();
    await archivo.setInputFiles(fixture('documento-firmado.pdf'));
    await expect(aviso(page, 'Comprobante bancario guardado.')).toBeVisible();
    const [bajada] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Descargar comprobante bancario' }).click()
    ]);
    expect(bajada.suggestedFilename()).toMatch(new RegExp('\.pdf$'));

    // El historial lo recuerda y permite reemplazarlo.
    await page.goto('/admin/historial/pagos');
    await page.getByLabel('Desde').fill(fechaEcuador(-1));
    await page.getByLabel('Buscar', { exact: true }).fill(numero);
    const fila = page.getByRole('row').filter({ hasText: numero });
    await expect(fila).toHaveCount(1);
    await expect(fila.getByRole('button', { name: 'Descargar comprobante bancario' })).toBeVisible();
    await expect(fila.getByRole('button', { name: 'Reemplazar comprobante bancario' })).toBeVisible();
  });

  test('ingresos y egresos resume el año por mes y detalla los movimientos', async ({ page }) => {
    await page.goto('/admin/historial/historial');
    const anio = fechaEcuador(0).slice(0, 4);
    const nodoAnio = page.getByRole('button', { name: new RegExp(`^${anio}`) });
    await expect(nodoAnio).toBeVisible();
    await expect(nodoAnio).toContainText(/\+\$[\d.]+/);
    await expect(nodoAnio).toContainText(/−\$[\d.]+/);
    if ((await nodoAnio.getAttribute('aria-expanded')) !== 'true') await nodoAnio.click();

    const mes = page.getByRole('button', { name: /pagos? ·|egresos?/ }).first();
    await mes.click();
    await expect(page.getByRole('columnheader', { name: 'Detalle' }).first()).toBeVisible();
    await expect(page.getByText(CONCEPTO_EGRESO)).toBeVisible();
  });
});
