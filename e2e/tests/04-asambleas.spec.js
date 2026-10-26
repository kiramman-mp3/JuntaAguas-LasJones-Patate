const { test, expect } = require('@playwright/test');
const { unico, fechaEcuador, aviso, dialogo, leerEstado, guardarEstado, descargarPdf, pdfEnPestana, fixture } = require('./ayudas');

// Una asamblea recorre su vida completa: convocatoria, documentos, asistencia, acta, cierre y multas.
test.describe.configure({ mode: 'serial' });

const TITULO = unico('Asamblea E2E');
// El tipo "Extraordinaria" se deduce del título (ver la prueba marcada como fallo conocido más abajo).
const TITULO_CANCELADA = unico('Asamblea Extraordinaria a cancelar E2E');
const punto = (page, n) => page.getByRole('textbox', { name: `Punto ${n}`, exact: true });
const tarjeta = (page, titulo) => page.locator('article.event-card', { hasText: titulo });

async function crearAsamblea(page, { titulo, subtipo = 'Ordinaria', fecha, puntos = [] }) {
  await page.goto('/admin/asistencias/asambleas');
  await page.getByRole('button', { name: 'Nueva asamblea' }).click();
  await page.getByRole('radio', { name: new RegExp(subtipo) }).check();
  await page.getByLabel('Título o asunto *').fill(titulo);
  await page.getByLabel('Fecha de la sesión *').fill(fecha);
  await page.getByLabel('Hora de inicio *').fill('00:01');
  await page.getByLabel('Lugar *').fill('Casa comunal de La Jones');
  for (const [i, punto] of puntos.entries()) {
    await page.getByRole('button', { name: 'Añadir punto' }).click();
    await punto(page, i + 1).fill(punto);
  }
  return page.getByRole('button', { name: 'Guardar convocatoria' });
}

test('la convocatoria exige título y guarda el orden del día con sus puntos', async ({ page }) => {
  const guardar = await crearAsamblea(page, { titulo: '', fecha: fechaEcuador(0) });
  await expect(guardar).toBeDisabled();

  await page.getByLabel('Título o asunto *').fill(TITULO);
  await page.getByRole('button', { name: 'Añadir punto' }).click();
  await punto(page, 1).fill('Lectura del acta anterior');
  await page.getByRole('button', { name: 'Añadir punto' }).click();
  await punto(page, 2).fill('Punto que se elimina');
  await page.getByRole('button', { name: 'Añadir punto' }).click();
  await punto(page, 3).fill('Informe de tesorería');
  await page.getByRole('button', { name: 'Eliminar punto 2' }).click();
  await expect(punto(page, 2)).toHaveValue('Informe de tesorería');

  await expect(guardar).toBeEnabled();
  await guardar.click();
  const card = tarjeta(page, TITULO);
  await expect(card).toBeVisible();
  await expect(card).toContainText('Ordinaria');
  await expect(card).toContainText('Borrador');
  await expect(card).toContainText('Casa comunal de La Jones');
});

test('la convocatoria se descarga como PDF desde el menú de la tarjeta', async ({ page }) => {
  await page.goto('/admin/asistencias/asambleas');
  const card = tarjeta(page, TITULO);
  await card.getByRole('button', { name: /^Más acciones de / }).click();
  const { nombre } = await descargarPdf(page, () => page.getByRole('menuitem', { name: 'Convocatoria en PDF' }).click());
  expect(nombre).toMatch(/\.pdf$/);
});

test('los documentos firmados aceptan PDF, rechazan otros archivos y se pueden ver', async ({ page }) => {
  await page.goto('/admin/asistencias/asambleas');
  const card = tarjeta(page, TITULO);
  await card.getByRole('button', { name: /Documentos firmados/ }).click();

  const subir = card.locator('input[type=file]').first();
  await subir.setInputFiles(fixture('no-es-pdf.txt'));
  await expect(dialogo(page)).toContainText('Archivo no válido');
  await dialogo(page).getByRole('button').last().click();
  await expect(dialogo(page)).toBeHidden();
  await expect(card.getByRole('button', { name: 'Ver convocatoria firmada' })).toHaveCount(0);

  await subir.setInputFiles(fixture('documento-firmado.pdf'));
  await expect(card.getByRole('button', { name: 'Ver convocatoria firmada' })).toBeVisible();
  await expect(card.getByRole('button', { name: /Documentos firmados/ })).toContainText('1 de 2');
  // La ficha del documento permite abrir el archivo guardado en el servidor.
  await card.getByRole('button', { name: 'Ver convocatoria firmada' }).click();
  const visor = page.getByRole('dialog');
  await expect(visor).toContainText('Documento firmado registrado');
  await pdfEnPestana(page, new RegExp('/uploads/documentos/'), () => visor.getByRole('button', { name: 'Abrir documento' }).click());
  await visor.getByRole('button', { name: 'Cerrar' }).last().click();
  await expect(visor).toBeHidden();
});

test('el padrón para firmas se descarga en PDF y el firmado se adjunta', async ({ page }) => {
  await page.goto('/admin/asistencias/asambleas');
  const card = tarjeta(page, TITULO);
  await card.getByRole('button', { name: /Documentos firmados/ }).click();
  const pdf = await pdfEnPestana(page, new RegExp('/pdf-asistencia'), () => card.getByRole('button', { name: 'Descargar padrón para firmas' }).click());
  expect(pdf.length).toBeGreaterThan(1500);

  await card.locator('input[type=file]').nth(1).setInputFiles(fixture('documento-firmado.pdf'));
  await expect(card.getByRole('button', { name: 'Ver padrón firmado' })).toBeVisible();
  await expect(card.getByRole('button', { name: /Documentos firmados/ })).toContainText('2 de 2');
});

test('WhatsApp avisa con claridad cuando el servicio no está disponible', async ({ page }) => {
  await page.goto('/admin/asistencias/asambleas');
  const card = tarjeta(page, TITULO);
  await card.getByRole('button', { name: /^Más acciones de / }).click();
  await page.getByRole('menuitem', { name: 'Convocar por WhatsApp' }).click();
  await expect(dialogo(page)).toContainText(TITULO);
  await dialogo(page).getByRole('button', { name: 'Publicar convocatoria' }).click();
  // Sin el servicio de WhatsApp el sistema informa el problema y la asamblea sigue en su estado.
  await expect(page.locator('.toast--error, .toast--danger, .toast--warning, .toast--info').first()).toBeVisible();
  await expect(card).toContainText('Borrador');
});

test('no se puede finalizar sin asistencia completa', async ({ page }) => {
  await page.goto('/admin/asistencias/asambleas');
  const card = tarjeta(page, TITULO);
  await card.getByRole('button', { name: 'Programar' }).click();
  await expect(card).toContainText('Programada');
  await card.getByRole('button', { name: 'Marcar convocada' }).click();
  await expect(card).toContainText('Convocada');

  await card.getByRole('button', { name: 'Finalizar', exact: true }).click();
  await expect(dialogo(page)).toContainText('Asistencia requerida');
  await dialogo(page).getByRole('button').last().click();
  await expect(dialogo(page)).toBeHidden();
  await expect(card).toContainText('Convocada');
});

test('la asistencia distingue presentes, ausentes y justificados con su motivo', async ({ page }) => {
  const { nuevo, bloqueable } = leerEstado();
  await page.goto('/admin/asistencias/asambleas');
  const card = tarjeta(page, TITULO);
  await card.getByRole('button', { name: 'Tomar asistencia' }).click();
  const modal = page.getByRole('dialog');

  await modal.getByRole('button', { name: 'Todos presentes' }).click();
  await modal.getByLabel('Filtrar usuarios').fill(nuevo.cedula);
  await modal.getByRole('group', { name: /^Asistencia de / }).getByRole('button', { name: 'Ausente' }).click();

  await modal.getByLabel('Filtrar usuarios').fill(bloqueable.cedula);
  const grupo = modal.getByRole('group', { name: /^Asistencia de / });
  await grupo.getByRole('button', { name: 'Justificado' }).click();
  await modal.getByLabel(/^Motivo de /).fill('Enfermedad con certificado médico');

  await modal.getByRole('button', { name: 'Guardar asistencia' }).click();
  await expect(modal).toBeHidden();
  // La tarjeta cuenta presentes sobre el total: faltan exactamente el ausente y el justificado.
  await expect(card).toContainText(/Asistencia\s*\d+ \/ \d+/);
  const [, presentes, total] = (await card.innerText()).match(/Asistencia\s*(\d+) \/ (\d+)/).map(Number);
  expect(total - presentes).toBe(2);
  guardarEstado({ asamblea: TITULO });
});

test('el acta recoge los temas tratados, se descarga en PDF y admite la versión firmada', async ({ page }) => {
  await page.goto('/admin/asistencias/asambleas');
  const card = tarjeta(page, TITULO);
  await card.getByRole('button', { name: 'Acta', exact: true }).click();
  const modal = page.getByRole('dialog');

  await modal.getByRole('button', { name: 'Añadir tema nuevo' }).click();
  await modal.getByLabel('Tema o asunto *').fill('Compra de una compuerta para el canal');
  await modal.getByLabel('Deliberación').first().fill('Se discutió el costo y la urgencia.');
  await modal.getByLabel('Resolución aprobada').fill('Se aprueba comprar la compuerta hasta $400.');
  await modal.getByRole('button', { name: 'Agregar', exact: false }).last().click();
  await modal.getByRole('button', { name: 'Guardar acta' }).click();
  await expect(aviso(page, /acta/i)).toBeVisible();

  await modal.getByRole('button', { name: 'Acta general (PDF)' }).click();
  await modal.locator('input[type=file]').setInputFiles(fixture('documento-firmado.pdf'));
  await expect(modal.getByRole('button', { name: 'Ver firmada' })).toBeVisible();
  await modal.getByRole('button', { name: 'Cerrar' }).last().click();
});

test('finalizar cierra la asamblea y multa solo a quien faltó sin justificar', async ({ page }) => {
  const { nuevo, bloqueable } = leerEstado();
  await page.goto('/admin/asistencias/asambleas');
  const card = tarjeta(page, TITULO);
  await card.getByRole('button', { name: 'Finalizar', exact: true }).click();
  const confirmacion = dialogo(page);
  await expect(confirmacion).toContainText('irreversible');
  await confirmacion.getByRole('button', { name: 'Dar por realizada' }).click();
  await expect(card).toContainText('Realizada');
  await expect(card.getByRole('button', { name: 'Ver asistencia' })).toBeVisible();

  // El ausente tiene la multa; el justificado, no.
  await page.goto('/admin/cobros/cobrar');
  await page.getByLabel('Buscar usuario').fill(nuevo.cedula);
  await page.getByRole('list', { name: 'Usuarios encontrados' }).getByRole('button').first().click();
  await page.getByRole('tab', { name: /Multas y otros/ }).click();
  await expect(page.getByText(/Multa por inasistencia a Asamblea|Multa por Inasistencia a Asamblea/i).first()).toBeVisible();

  await page.getByRole('button', { name: 'Cambiar usuario' }).click();
  await page.getByLabel('Buscar usuario').fill(bloqueable.cedula);
  await page.getByRole('list', { name: 'Usuarios encontrados' }).getByRole('button').first().click();
  await page.getByRole('tab', { name: /Multas y otros/ }).click();
  await expect(page.getByText(/Multa por inasistencia a Asamblea/i)).toHaveCount(0);
});

test('una asamblea realizada ya no tiene acciones de estado, pero admite corregir la asistencia', async ({ page }) => {
  const { nuevo } = leerEstado();
  await page.goto('/admin/asistencias/asambleas');
  const card = tarjeta(page, TITULO);
  await expect(card.getByRole('button', { name: /^Más acciones de / })).toHaveCount(0);
  await expect(card.getByRole('button', { name: 'Finalizar', exact: true })).toHaveCount(0);

  // Corrección posterior: el ausente presenta su justificación y la multa pendiente se anula.
  await card.getByRole('button', { name: 'Ver asistencia' }).click();
  const modal = page.getByRole('dialog');
  await modal.getByLabel('Filtrar usuarios').fill(nuevo.cedula);
  await modal.getByRole('group', { name: /^Asistencia de / }).getByRole('button', { name: 'Justificado' }).click();
  await modal.getByLabel(/^Motivo de /).fill('Presentó certificado de trabajo fuera de la ciudad');
  await modal.getByRole('button', { name: 'Guardar asistencia' }).click();
  await expect(modal).toBeHidden();

  await page.goto('/admin/cobros/cobrar');
  await page.getByLabel('Buscar usuario').fill(nuevo.cedula);
  await page.getByRole('list', { name: 'Usuarios encontrados' }).getByRole('button').first().click();
  await page.getByRole('tab', { name: /Multas y otros/ }).click();
  await expect(page.getByText(/Multa por inasistencia a Asamblea/i)).toHaveCount(0);
});

test('el tipo elegido en el formulario se conserva al guardar la asamblea', async ({ page }) => {
  // FALLO CONOCIDO: el servidor no tiene una columna para el subtipo, así que "Extraordinaria" se pierde
  // salvo que el título lo diga. Cuando se corrija, esta prueba pasará y Playwright avisará de quitar la marca.
  test.fail(true, 'El subtipo de la asamblea no se persiste: la lista lo deduce del título.');
  const titulo = unico('Sesion urgente E2E');
  const guardar = await crearAsamblea(page, { titulo, subtipo: 'Extraordinaria', fecha: fechaEcuador(12) });
  await guardar.click();
  await expect(tarjeta(page, titulo)).toContainText('Extraordinaria');
});

test('cancelar una asamblea la archiva sin multas ni más acciones', async ({ page }) => {
  const guardar = await crearAsamblea(page, { titulo: TITULO_CANCELADA, subtipo: 'Extraordinaria', fecha: fechaEcuador(10) });
  await guardar.click();
  const card = tarjeta(page, TITULO_CANCELADA);
  await expect(card).toContainText('Extraordinaria');

  await card.getByRole('button', { name: /^Más acciones de / }).click();
  await page.getByRole('menuitem', { name: 'Cancelar asamblea' }).click();
  await dialogo(page).getByRole('button', { name: 'Sí, cancelar asamblea' }).click();
  await expect(card).toContainText('Cancelada');
  await expect(card.getByRole('button', { name: /^Más acciones de / })).toHaveCount(0);

  // Las canceladas no aparecen en el tablón público.
  await page.context().clearCookies();
  await page.goto('/eventos');
  await expect(page.getByText(TITULO_CANCELADA)).toHaveCount(0);
});

test('la lista se filtra por texto, tipo y período', async ({ page }) => {
  await page.goto('/admin/asistencias/asambleas');
  await page.getByLabel('Buscar asamblea').fill(TITULO_CANCELADA);
  await expect(page.locator('article.event-card')).toHaveCount(1);

  await page.getByLabel('Buscar asamblea').fill('');
  await page.getByLabel('Tipo de asamblea').selectOption('EXTRAORDINARIA');
  await expect(tarjeta(page, TITULO)).toHaveCount(0);
  await expect(tarjeta(page, TITULO_CANCELADA)).toHaveCount(1);

  await page.getByLabel('Tipo de asamblea').selectOption('TODAS');
  // Las dos son de hoy o posteriores: aparecen en "Hoy y próximas" y no en "Anteriores".
  await page.getByLabel('Período').selectOption('PROXIMAS');
  await expect(tarjeta(page, TITULO)).toHaveCount(1);
  await expect(tarjeta(page, TITULO_CANCELADA)).toHaveCount(1);
  await page.getByLabel('Período').selectOption('ANTERIORES');
  await expect(tarjeta(page, TITULO)).toHaveCount(0);
  await expect(tarjeta(page, TITULO_CANCELADA)).toHaveCount(0);

  await page.getByLabel('Buscar asamblea').fill('zzzz-no-existe');
  await expect(page.getByText('Sin coincidencias')).toBeVisible();
});
