const { test, expect } = require('@playwright/test');
const { PUERTO_WHATSAPP, TOKEN_WHATSAPP } = require('../entorno');
const { GRUPOS } = require('../whatsapp-simulado');
const { unico, fechaEcuador, aviso, dialogo } = require('./ayudas');

// WhatsApp de la Junta: el servicio real con un teléfono simulado (ver whatsapp-simulado.js).
test.describe.configure({ mode: 'serial' });

const BASE = `http://127.0.0.1:${PUERTO_WHATSAPP}`;
const CABECERAS = { Authorization: `Bearer ${TOKEN_WHATSAPP}` };
const control = (request, ruta, data) => request.post(`${BASE}/__control/${ruta}`, { headers: CABECERAS, data });
const enviados = async (request) => (await (await request.get(`${BASE}/__control/enviados`, { headers: CABECERAS })).json()).data;

const MINGA = unico('Minga WhatsApp E2E');
const ASAMBLEA = unico('Asamblea WhatsApp E2E');
const tarjeta = (page, titulo) => page.locator('article.event-card', { hasText: titulo });

async function crearMinga(page, titulo) {
  await page.goto('/admin/asistencias/mingas');
  await page.getByRole('button', { name: 'Nueva minga' }).click();
  await page.getByLabel('Actividad / título').fill(titulo);
  await page.getByLabel('Trabajo a realizar').fill('Limpieza del canal (prueba de WhatsApp).');
  await page.getByLabel('Fecha *').fill(fechaEcuador(8));
  await page.getByLabel('Hora de inicio').fill('07:00');
  await page.getByLabel('Lugar de encuentro').fill('Bocatoma del canal matriz');
  await page.getByRole('button', { name: 'Guardar minga' }).click();
  await expect(tarjeta(page, titulo)).toBeVisible();
}

async function convocarMinga(page, titulo) {
  const card = tarjeta(page, titulo);
  await card.getByRole('button', { name: 'Convocar por WhatsApp' }).click();
  await expect(dialogo(page)).toContainText(titulo);
  await dialogo(page).getByRole('button', { name: 'Publicar convocatoria' }).click();
  return card;
}

test.beforeAll(async ({ request }) => {
  await control(request, 'reiniciar');
});

test('el panel pide vincular el teléfono y muestra el código QR', async ({ page }) => {
  await page.goto('/admin/dashboard');
  await page.getByRole('button', { name: 'WhatsApp Web' }).click();
  const panel = page.getByRole('dialog');
  await expect(panel).toContainText('WhatsApp de la Junta');
  await expect(panel).toContainText('WhatsApp no está conectado');

  await panel.getByRole('button', { name: 'Conectar WhatsApp' }).click();
  await expect(panel.getByRole('img', { name: 'Código QR para vincular WhatsApp' })).toBeVisible();
  await expect(panel).toContainText('Escanee el código con el WhatsApp de la Junta');
});

test('al escanear el QR la sesión queda conectada y se elige el grupo de convocatorias', async ({ page, request }) => {
  await page.goto('/admin/dashboard');
  await page.getByRole('button', { name: 'WhatsApp Web' }).click();
  const panel = page.getByRole('dialog');
  await control(request, 'escanear');
  await expect(panel.locator('#wa-grupo')).toBeVisible({ timeout: 20_000 });
  await expect(panel).toContainText(`${GRUPOS.length} de ${GRUPOS.length} grupos`);
  await expect(panel).toContainText('Elija el grupo donde se publicarán las convocatorias.');

  // La búsqueda filtra la lista; el grupo se guarda y queda como el actual.
  await panel.getByLabel('Buscar grupo de WhatsApp').fill('directiva');
  await expect(panel).toContainText(`1 de ${GRUPOS.length} grupos`);
  await panel.getByLabel('Buscar grupo de WhatsApp').fill('zzz');
  await expect(panel).toContainText('Ningún grupo coincide');
  await panel.getByLabel('Buscar grupo de WhatsApp').fill('');

  await panel.locator('#wa-grupo').selectOption(GRUPOS[0].id);
  await panel.getByRole('button', { name: 'Usar este grupo' }).click();
  await expect(panel).toContainText('Actual: Usuarios Junta La Jones');
});

test('convocar una minga publica el mensaje en el grupo y la deja convocada', async ({ page, request }) => {
  await crearMinga(page, MINGA);
  const card = await convocarMinga(page, MINGA);
  await expect(aviso(page, /publicada|convocatoria/i)).toBeVisible();
  await expect(card).toContainText('Convocada');

  const mensajes = await enviados(request);
  expect(mensajes).toHaveLength(1);
  expect(mensajes[0].grupoId).toBe(GRUPOS[0].id);
  expect(mensajes[0].texto).toContain('CONVOCATORIA A MINGA COMUNITARIA');
  expect(mensajes[0].texto).toContain(MINGA);
  expect(mensajes[0].texto).toContain('Bocatoma del canal matriz');
  expect(mensajes[0].texto).toContain('Traer sus herramientas de trabajo.');
});

test('una convocatoria ya publicada no se vuelve a enviar al grupo', async ({ page, request }) => {
  await page.goto('/admin/asistencias/mingas');
  const card = tarjeta(page, MINGA);
  await card.getByRole('button', { name: 'Convocar por WhatsApp' }).click();
  await dialogo(page).getByRole('button', { name: 'Publicar convocatoria' }).click();
  await expect(page.locator('.toast--info, .toast--warning, .toast--error').first()).toBeVisible();
  expect(await enviados(request)).toHaveLength(1);
});

test('si WhatsApp rechaza el mensaje, la asamblea sigue sin convocar y se puede reintentar', async ({ page, request }) => {
  await page.goto('/admin/asistencias/asambleas');
  await page.getByRole('button', { name: 'Nueva asamblea' }).click();
  await page.getByLabel('Título o asunto *').fill(ASAMBLEA);
  await page.getByLabel('Fecha de la sesión *').fill(fechaEcuador(9));
  await page.getByLabel('Hora de inicio *').fill('08:00');
  await page.getByLabel('Lugar *').fill('Casa comunal de La Jones');
  await page.getByRole('button', { name: 'Añadir punto' }).click();
  await page.getByRole('textbox', { name: 'Punto 1', exact: true }).fill('Rendición de cuentas');
  await page.getByRole('button', { name: 'Guardar convocatoria' }).click();
  const card = tarjeta(page, ASAMBLEA);
  await expect(card).toContainText('Borrador');

  await control(request, 'fallo', { activo: true });
  await card.getByRole('button', { name: /^Más acciones de / }).click();
  await page.getByRole('menuitem', { name: 'Convocar por WhatsApp' }).click();
  await dialogo(page).getByRole('button', { name: 'Publicar convocatoria' }).click();
  await expect(page.locator('.toast--error').first()).toBeVisible();
  await expect(card).toContainText('Borrador');
  expect(await enviados(request)).toHaveLength(1); // solo el de la minga anterior

  // Con WhatsApp de vuelta, el reintento publica el orden del día completo.
  await control(request, 'fallo', { activo: false });
  await card.getByRole('button', { name: /^Más acciones de / }).click();
  await page.getByRole('menuitem', { name: 'Convocar por WhatsApp' }).click();
  await dialogo(page).getByRole('button', { name: 'Publicar convocatoria' }).click();
  await expect(card).toContainText('Convocada');
  const mensajes = await enviados(request);
  expect(mensajes).toHaveLength(2);
  expect(mensajes[1].texto).toContain('CONVOCATORIA A ASAMBLEA GENERAL');
  expect(mensajes[1].texto).toContain('Orden del día');
  expect(mensajes[1].texto).toContain('1. Rendición de cuentas');
});

test('si el servicio de WhatsApp está apagado, el sistema lo informa y sigue funcionando', async ({ page, request }) => {
  await control(request, 'caer');
  try {
    await page.goto('/admin/dashboard');
    await expect(page.getByText('Resumen de la Junta')).toBeVisible(); // el resto del sistema no se ve afectado
    await page.getByRole('button', { name: 'WhatsApp Web' }).click();
    const panel = page.getByRole('dialog');
    await expect(panel).toContainText(/no está disponible|no respondió|NO_DISPONIBLE/i);
    await page.keyboard.press('Escape');
  } finally {
    await control(request, 'levantar');
  }
});

test('desvincular el teléfono cierra la sesión y pide escanear de nuevo', async ({ page }) => {
  await page.goto('/admin/dashboard');
  await page.getByRole('button', { name: 'WhatsApp Web' }).click();
  const panel = page.getByRole('dialog').first();
  await expect(panel.getByRole('button', { name: 'Desvincular' })).toBeVisible();
  await panel.getByRole('button', { name: 'Desvincular' }).click();
  await expect(dialogo(page)).toContainText('código QR nuevo');
  await dialogo(page).getByRole('button', { name: 'Desvincular' }).click();
  await expect(panel).toContainText(/Sesión de WhatsApp cerrada|no está conectado/);
  await expect(panel.getByRole('button', { name: 'Conectar WhatsApp' })).toBeVisible();
});
