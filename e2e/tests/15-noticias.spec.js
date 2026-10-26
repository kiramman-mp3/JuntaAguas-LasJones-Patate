const { test, expect } = require('@playwright/test');
const { unico, fechaEcuador, aviso, dialogo, fixture } = require('./ayudas');

// Noticias: el público lee la portada (5 recientes), el archivo con filtros y el detalle; la directiva las administra.
test.describe.configure({ mode: 'serial' });

const SIN_SESION = { cookies: [], origins: [] };
const TITULO = unico('Noticia E2E');
const TITULO_EDITADO = unico('Noticia E2E editada');
const tarjetas = (page) => page.locator('article.noticia-card');

test.describe('lectura pública (datos sembrados: 8 noticias)', () => {
  test.use({ storageState: SIN_SESION });

  test('el menú tiene la pestaña Noticias que abre la portada', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('link', { name: 'Noticias' }).click();
    await expect(page).toHaveURL(new RegExp('/noticias$'));
    await expect(page.getByRole('heading', { name: 'Noticias', level: 1 })).toBeVisible();
  });

  test('la portada muestra solo las 5 noticias más recientes y un botón para ver más', async ({ page }) => {
    await page.goto('/noticias');
    await expect(tarjetas(page)).toHaveCount(5);
    // La primera es la más reciente (la sembrada hace dos días) y se presenta destacada.
    await expect(tarjetas(page).first()).toContainText('Minga de limpieza del canal matriz antes del verano');
    await expect(page.locator('app-noticia-tarjeta.destacada')).toHaveCount(1);
    await expect(tarjetas(page).first().locator('img')).toBeVisible();
    await expect(tarjetas(page).first().locator('time')).not.toBeEmpty();
    await expect(page.getByText('8 noticias publicadas')).toBeVisible();

    // Orden: de la más reciente a la más antigua.
    const titulos = await tarjetas(page).locator('.noticia-card__titulo').allInnerTexts();
    expect(titulos.map((t) => t.trim())).toEqual([
      'Minga de limpieza del canal matriz antes del verano',
      'Rendición de cuentas: fecha y lugar de la asamblea',
      'Nuevos turnos de riego para la temporada seca',
      'Pago anual de agua: cómo cancelar por transferencia o en secretaría',
      'Reparación de la compuerta de El Tambo'
    ]);

    await page.getByRole('link', { name: 'Ver más noticias' }).click();
    await expect(page).toHaveURL(new RegExp('/noticias/todas$'));
  });

  test('las imágenes de las noticias cargan desde el servidor sin iniciar sesión', async ({ page }) => {
    await page.goto('/noticias');
    await expect(tarjetas(page)).toHaveCount(5);
    const cargadas = await page.locator('article.noticia-card img').evaluateAll((imgs) => imgs.map((i) => i.complete && i.naturalWidth > 0));
    expect(cargadas.every(Boolean)).toBe(true);
  });

  test('el archivo lista todas las noticias, pagina y recuerda la página en la dirección', async ({ page }) => {
    await page.goto('/noticias/todas');
    await expect(page.getByRole('heading', { name: 'Todas las noticias' })).toBeVisible();
    await expect(tarjetas(page)).toHaveCount(8);
    await expect(page.getByText('8 noticias', { exact: false }).first()).toBeVisible();

    await page.getByLabel('Registros por página').selectOption('6');
    await expect(tarjetas(page)).toHaveCount(6);
    await page.getByRole('navigation', { name: 'Paginación' }).getByRole('button', { name: /Siguiente|siguiente/ }).click();
    await expect(tarjetas(page)).toHaveCount(2);
    await expect(page).toHaveURL(new RegExp('pagina=2'));
  });

  test('filtra por etiqueta con la cantidad de cada una y la deja en la dirección', async ({ page }) => {
    await page.goto('/noticias/todas');
    const opciones = await page.locator('#noticias-tag option').allInnerTexts();
    expect(opciones.map((o) => o.trim())).toContain('canal (2)');

    await page.locator('#noticias-tag').selectOption('canal');
    await expect(tarjetas(page)).toHaveCount(2);
    await expect(page).toHaveURL(new RegExp('tag=canal'));
    await expect(page.getByText('con la etiqueta')).toContainText('canal');
    for (const etiquetas of await tarjetas(page).locator('.noticia-card__tags').allInnerTexts()) expect(etiquetas).toContain('canal');

    // Una dirección con filtros se abre ya filtrada.
    await page.goto('/noticias/todas?tag=asamblea');
    await expect(tarjetas(page)).toHaveCount(2);
    await expect(page.locator('#noticias-tag')).toHaveValue('asamblea');
  });

  test('filtra por texto (título, descripción o etiqueta) y avisa cuando no hay coincidencias', async ({ page }) => {
    await page.goto('/noticias/todas');
    await page.locator('#noticias-q').fill('compuerta');
    await expect(tarjetas(page)).toHaveCount(1);
    await expect(tarjetas(page).first()).toContainText('Reparación de la compuerta de El Tambo');

    await page.locator('#noticias-q').fill('elecciones');
    await expect(tarjetas(page)).toHaveCount(1);
    await expect(tarjetas(page).first()).toContainText('Elección de la nueva directiva');

    await page.locator('#noticias-q').fill('zzzz-no-existe');
    await expect(page.getByText('Sin coincidencias')).toBeVisible();
    await page.getByRole('button', { name: 'Limpiar filtros' }).first().click();
    await expect(tarjetas(page)).toHaveCount(8);
    await expect(page.locator('#noticias-q')).toHaveValue('');
  });

  test('filtra por rango de fechas y advierte si el rango está al revés', async ({ page }) => {
    await page.goto('/noticias/todas');
    // Las sembradas están 2, 11, 20… días atrás: este rango trae las dos más recientes.
    await page.locator('#noticias-desde').fill(fechaEcuador(-12));
    await expect(tarjetas(page)).toHaveCount(2);
    await page.locator('#noticias-hasta').fill(fechaEcuador(-5));
    await expect(tarjetas(page)).toHaveCount(1);
    await expect(tarjetas(page).first()).toContainText('Rendición de cuentas');

    await page.locator('#noticias-desde').fill(fechaEcuador(0));
    await page.locator('#noticias-hasta').fill(fechaEcuador(-30));
    await expect(page.getByRole('alert').filter({ hasText: 'posterior a la final' })).toBeVisible();
    await expect(tarjetas(page)).toHaveCount(0);
  });

  test('combina etiqueta y texto', async ({ page }) => {
    await page.goto('/noticias/todas?tag=riego&q=turnos');
    await expect(tarjetas(page)).toHaveCount(1);
    await expect(tarjetas(page).first()).toContainText('Nuevos turnos de riego');
  });

  test('el detalle muestra la imagen, las etiquetas y la descripción larga', async ({ page }) => {
    await page.goto('/noticias');
    await tarjetas(page).nth(1).getByRole('link', { name: 'Rendición de cuentas: fecha y lugar de la asamblea' }).click();
    await expect(page).toHaveURL(new RegExp('/noticias/[0-9]+$'));
    await expect(page.getByRole('heading', { name: 'Rendición de cuentas: fecha y lugar de la asamblea', level: 1 })).toBeVisible();
    await expect(page.getByText('Se presentará el informe de tesorería')).toBeVisible();
    await expect(page.locator('.noticia-detalle__imagen')).toBeVisible();

    // Una etiqueta del detalle lleva al archivo ya filtrado.
    await page.getByRole('link', { name: 'finanzas', exact: true }).click();
    await expect(page).toHaveURL(new RegExp('/noticias/todas\\?tag=finanzas'));
    await expect(tarjetas(page)).toHaveCount(2);
  });

  test('una noticia que no existe muestra un aviso con salida al archivo', async ({ page }) => {
    await page.goto('/noticias/999999');
    await expect(page.getByText('Noticia no encontrada')).toBeVisible();
    await page.getByRole('link', { name: 'Ver todas las noticias' }).first().click();
    await expect(page).toHaveURL(new RegExp('/noticias/todas$'));
  });
});

test.describe('administración (directiva)', () => {
  const filaDe = (page, titulo) => page.getByRole('row').filter({ hasText: titulo });

  test('Noticias aparece en el menú del panel y lista las publicadas', async ({ page }) => {
    await page.goto('/admin/dashboard');
    await page.getByRole('navigation', { name: 'Secciones del panel' }).getByRole('link', { name: 'Noticias' }).first().click();
    await expect(page).toHaveURL(new RegExp('/admin/noticias'));
    await expect(page.getByRole('heading', { name: 'Noticias', level: 3 })).toBeVisible();
    await expect(page.locator('tbody tr')).toHaveCount(8);
  });

  test('publicar exige título, etiquetas, descripciones e imagen', async ({ page }) => {
    await page.goto('/admin/noticias');
    await page.getByRole('button', { name: 'Nueva noticia' }).click();
    const publicar = () => page.getByRole('button', { name: 'Publicar noticia' }).click();

    await publicar();
    await expect(aviso(page, /título debe tener entre/i)).toBeVisible();

    await page.locator('#noticia-titulo').fill(TITULO);
    await publicar();
    await expect(aviso(page, 'Indique al menos una etiqueta.')).toBeVisible();

    await page.locator('#noticia-etiqueta').fill('E2E');
    await page.locator('#noticia-etiqueta').press('Enter');
    await publicar();
    await expect(aviso(page, /descripción corta/i)).toBeVisible();

    await page.locator('#noticia-corta').fill('Resumen de la noticia de prueba E2E.');
    await publicar();
    await expect(aviso(page, /descripción larga/i)).toBeVisible();

    await page.locator('#noticia-larga').fill('Primera línea de la noticia.\nSegunda línea de la noticia de prueba.');
    await publicar();
    await expect(aviso(page, 'La imagen de la noticia es obligatoria.')).toBeVisible();

    // Un PDF no es una imagen.
    await page.locator('#noticia-imagen').setInputFiles(fixture('documento-firmado.pdf'));
    await expect(page.getByText('Elija una imagen JPG o PNG.')).toBeVisible();
  });

  test('las etiquetas se escriben como fichas: minúsculas, sin repetir y se pueden quitar', async ({ page }) => {
    await page.goto('/admin/noticias');
    await page.getByRole('button', { name: 'Nueva noticia' }).click();
    const campo = page.locator('#noticia-etiqueta');
    for (const texto of ['Minga', 'MINGA', 'Riego 2026']) {
      await campo.fill(texto);
      await campo.press('Enter');
    }
    await campo.fill('canal,');
    await campo.press(',');
    const fichas = page.locator('.etiqueta-chip');
    await expect(fichas).toHaveCount(3);
    expect((await fichas.allInnerTexts()).map((t) => t.trim())).toEqual(['minga', 'riego 2026', 'canal']);

    await page.getByRole('button', { name: 'Quitar etiqueta riego 2026' }).click();
    await expect(fichas).toHaveCount(2);
    // Retroceso en el campo vacío quita la última.
    await campo.press('Backspace');
    await expect(fichas).toHaveCount(1);
  });

  test('una noticia completa se publica y pasa a ser la primera de la portada', async ({ page }) => {
    await page.goto('/admin/noticias');
    await page.getByRole('button', { name: 'Nueva noticia' }).click();
    await page.locator('#noticia-titulo').fill(TITULO);
    for (const etiqueta of ['e2e', 'prueba']) {
      await page.locator('#noticia-etiqueta').fill(etiqueta);
      await page.locator('#noticia-etiqueta').press('Enter');
    }
    await page.locator('#noticia-corta').fill('Resumen de la noticia de prueba E2E.');
    await page.locator('#noticia-larga').fill('Primera línea de la noticia.\nSegunda línea de la noticia de prueba.');
    await page.locator('#noticia-imagen').setInputFiles(fixture('imagen.png'));
    await expect(page.getByAltText('Vista previa de la imagen de la noticia')).toBeVisible();
    await page.getByRole('button', { name: 'Publicar noticia' }).click();
    await expect(aviso(page, /publicada/i)).toBeVisible();

    const fila = filaDe(page, TITULO);
    await expect(fila).toHaveCount(1);
    await expect(fila).toContainText('e2e');
    await expect(fila).toContainText('prueba');
    await expect(page.locator('tbody tr').first()).toContainText(TITULO);

    // El público la ve primera en la portada; la quinta sembrada sale de la portada.
    await page.context().clearCookies();
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await page.goto('/noticias');
    await expect(tarjetas(page)).toHaveCount(5);
    await expect(tarjetas(page).first()).toContainText(TITULO);
    await expect(page.getByText('Reparación de la compuerta de El Tambo')).toHaveCount(0);
    await expect(page.getByText('9 noticias publicadas')).toBeVisible();
  });
});

test.describe('administración: edición y baja', () => {
  const filaDe = (page, titulo) => page.getByRole('row').filter({ hasText: titulo });

  test('la noticia publicada conserva sus saltos de línea en el detalle público', async ({ browser }) => {
    const contexto = await browser.newContext({ storageState: SIN_SESION, baseURL: 'http://127.0.0.1:3210' });
    const page = await contexto.newPage();
    await page.goto('/noticias');
    await tarjetas(page).first().getByRole('link', { name: TITULO }).click();
    const texto = page.locator('.noticia-detalle__texto');
    await expect(texto).toContainText('Primera línea de la noticia.');
    const alturas = await texto.evaluate((el) => ({ conSalto: getComputedStyle(el).whiteSpace }));
    expect(alturas.conSalto).toBe('pre-line');
    await contexto.close();
  });

  test('editar carga la noticia completa, cambia título y etiquetas y conserva la imagen', async ({ page }) => {
    await page.goto('/admin/noticias');
    const imagenAntes = await filaDe(page, TITULO).locator('img').getAttribute('src');
    await filaDe(page, TITULO).getByRole('button', { name: `Editar noticia ${TITULO}` }).click();

    await expect(page.getByRole('heading', { name: 'Editar noticia' })).toBeVisible();
    await expect(page.locator('#noticia-larga')).toHaveValue(/Segunda línea de la noticia de prueba\./);
    await expect(page.getByText('Imagen actual')).toBeVisible();

    await page.locator('#noticia-titulo').fill(TITULO_EDITADO);
    await page.getByRole('button', { name: 'Quitar etiqueta prueba' }).click();
    await page.locator('#noticia-etiqueta').fill('actualizada');
    await page.locator('#noticia-etiqueta').press('Enter');
    await page.getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(aviso(page, /actualizada/i)).toBeVisible();

    const fila = filaDe(page, TITULO_EDITADO);
    await expect(fila).toHaveCount(1);
    await expect(fila.locator('.noticia-etiquetas')).toContainText('actualizada');
    await expect(fila.locator('.noticia-etiquetas')).not.toContainText('prueba');
    await expect(fila.locator('img')).toHaveAttribute('src', imagenAntes);
  });

  test('adjuntar otra imagen reemplaza la anterior', async ({ page }) => {
    await page.goto('/admin/noticias');
    const imagenAntes = await filaDe(page, TITULO_EDITADO).locator('img').getAttribute('src');
    await filaDe(page, TITULO_EDITADO).getByRole('button', { name: `Editar noticia ${TITULO_EDITADO}` }).click();
    await page.locator('#noticia-imagen').setInputFiles(fixture('imagen.png'));
    await expect(page.getByText('Imagen nueva')).toBeVisible();
    await page.getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(aviso(page, /actualizada/i)).toBeVisible();

    const imagenDespues = await filaDe(page, TITULO_EDITADO).locator('img').getAttribute('src');
    expect(imagenDespues).not.toBe(imagenAntes);
    const anterior = await page.request.get(imagenAntes);
    expect(anterior.status(), 'la imagen anterior se eliminó del servidor').toBe(404);
    expect((await page.request.get(imagenDespues)).status()).toBe(200);
  });

  test('la edición valida igual que la publicación', async ({ page }) => {
    await page.goto('/admin/noticias');
    await filaDe(page, TITULO_EDITADO).getByRole('button', { name: `Editar noticia ${TITULO_EDITADO}` }).click();
    await page.locator('#noticia-titulo').fill('Hey');
    await page.getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(aviso(page, /título debe tener entre/i)).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Cancelar', exact: true }).click();
    await expect(filaDe(page, TITULO_EDITADO)).toHaveCount(1);
  });

  test('la búsqueda del panel filtra por título y etiqueta', async ({ page }) => {
    await page.goto('/admin/noticias');
    await page.getByLabel('Buscar noticia').fill(TITULO_EDITADO);
    await expect(page.locator('tbody tr')).toHaveCount(1);
    await page.getByLabel('Buscar noticia').fill('actualizada');
    await expect(page.locator('tbody tr')).toHaveCount(1);
    await page.getByLabel('Buscar noticia').fill('zzzz-no-existe');
    await expect(page.getByText('Sin coincidencias')).toBeVisible();
  });

  test('eliminar pide confirmación; al aceptar la noticia desaparece del panel y del portal', async ({ page, browser }) => {
    await page.goto('/admin/noticias');
    const imagen = await filaDe(page, TITULO_EDITADO).locator('img').getAttribute('src');

    await filaDe(page, TITULO_EDITADO).getByRole('button', { name: `Eliminar noticia ${TITULO_EDITADO}` }).click();
    await expect(dialogo(page)).toContainText('no se puede deshacer');
    await dialogo(page).getByRole('button', { name: 'Cancelar' }).click();
    await expect(filaDe(page, TITULO_EDITADO)).toHaveCount(1);

    await filaDe(page, TITULO_EDITADO).getByRole('button', { name: `Eliminar noticia ${TITULO_EDITADO}` }).click();
    await dialogo(page).getByRole('button', { name: 'Eliminar' }).click();
    await expect(aviso(page, /eliminada/i)).toBeVisible();
    await expect(filaDe(page, TITULO_EDITADO)).toHaveCount(0);
    expect((await page.request.get(imagen)).status()).toBe(404);

    const contexto = await browser.newContext({ storageState: SIN_SESION, baseURL: 'http://127.0.0.1:3210' });
    const publico = await contexto.newPage();
    await publico.goto('/noticias');
    await expect(publico.getByText(TITULO_EDITADO)).toHaveCount(0);
    await expect(publico.getByText('8 noticias publicadas')).toBeVisible();
    await expect(tarjetas(publico).first()).toContainText('Minga de limpieza del canal matriz antes del verano');
    await contexto.close();
  });

  test('quedó el rastro de publicar, modificar y eliminar en la auditoría', async ({ page }) => {
    await page.goto('/admin/gestion/auditoria');
    await page.locator('#aud-desde').fill(fechaEcuador(-1));
    await page.locator('#aud-hasta').fill(fechaEcuador(0));
    await page.locator('#aud-entidad').fill('noticias');
    await Promise.all([page.waitForResponse((r) => r.url().includes('/api/auditoria')), page.locator('#aud-entidad').press('Enter')]);
    const acciones = page.locator('tbody tr').locator('td:nth-child(3)');
    await expect(acciones.filter({ hasText: 'CREAR' })).not.toHaveCount(0);
    await expect(acciones.filter({ hasText: 'MODIFICAR' })).toHaveCount(2);
    await expect(acciones.filter({ hasText: 'ELIMINAR' })).toHaveCount(1);
  });
});

test.describe('permisos', () => {
  test.use({ storageState: SIN_SESION });

  test('sin sesión no se puede publicar, editar ni eliminar desde la API', async ({ request }) => {
    const cuerpo = { multipart: { titulo: 'No debería', descripcion_corta: 'x'.repeat(12), descripcion_larga: 'x'.repeat(30), tags: '["a1"]' } };
    expect((await request.post('/api/noticias', cuerpo)).status()).toBe(401);
    expect((await request.put('/api/noticias/1', cuerpo)).status()).toBe(401);
    expect((await request.delete('/api/noticias/1')).status()).toBe(401);
    expect((await request.get('/api/noticias')).status()).toBe(200);
  });

  test('un usuario común no entra al panel de noticias', async ({ page }) => {
    const { credenciales, iniciarSesion } = require('./ayudas');
    const { usuario, password } = credenciales();
    await iniciarSesion(page, { cedula: usuario.cedula, password });
    await expect(page).toHaveURL(new RegExp('/mi-cuenta'));
    await page.goto('/admin/noticias');
    await expect(page).not.toHaveURL(new RegExp('/admin'));
  });
});
