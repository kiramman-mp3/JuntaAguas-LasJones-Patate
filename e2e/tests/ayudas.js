const fs = require('fs');
const { expect } = require('@playwright/test');
const { ARCHIVO_CREDENCIALES } = require('../entorno');

const credenciales = () => JSON.parse(fs.readFileSync(ARCHIVO_CREDENCIALES, 'utf8'));

const ZONA = 'America/Guayaquil';

/** Fecha 'AAAA-MM-DD' en Ecuador, `dias` después de hoy (negativo: antes). */
function fechaEcuador(dias = 0) {
  const base = new Date(Date.now() + dias * 86400000);
  return base.toLocaleDateString('en-CA', { timeZone: ZONA });
}

/** Sufijo corto y distinto en cada ejecución para que los datos creados no choquen entre pruebas. */
let contador = 0;
const unico = (prefijo) => `${prefijo} ${Date.now().toString(36)}${(contador++).toString(36)}`;

/**
 * Cédula ecuatoriana con dígito verificador válido (misma regla que backend/src/shared/schemas.js).
 * `n` (0-999999) elige el número; la provincia 18 es Tungurahua.
 */
function cedulaValida(n) {
  const base = `180${String(n).padStart(6, '0')}`;
  let suma = 0;
  for (let i = 0; i < 9; i += 1) {
    let valor = Number(base[i]) * (i % 2 === 0 ? 2 : 1);
    if (valor >= 10) valor -= 9;
    suma += valor;
  }
  return `${base}${suma % 10 === 0 ? 0 : 10 - (suma % 10)}`;
}

/** Cédula distinta en cada ejecución (la base E2E se siembra de nuevo, pero no entre pruebas). */
let cedulaSiguiente = 700000 + (Date.now() % 90000);
const cedulaNueva = () => cedulaValida(cedulaSiguiente++);

async function iniciarSesion(page, { cedula, password, recordar = false }) {
  await page.goto('/login');
  await page.getByLabel('Usuario o Cédula').fill(cedula);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  if (recordar) await page.getByLabel('Recordar mi sesión').check();
  await page.getByRole('button', { name: 'Ingresar al Sistema' }).click();
}

/** Diálogo de confirmación o de motivo (el último abierto). */
const dialogo = (page) => page.getByRole('alertdialog').or(page.getByRole('dialog')).last();

/** Aviso emergente (toast) con el texto indicado. */
const aviso = (page, texto) => page.locator('.toast__message', { hasText: texto }).first();

/** Estado compartido entre archivos (las pruebas dependientes corren en orden). */
const ARCHIVO_ESTADO = require('path').join(__dirname, '..', '.auth', 'estado.json');
const leerEstado = () => (fs.existsSync(ARCHIVO_ESTADO) ? JSON.parse(fs.readFileSync(ARCHIVO_ESTADO, 'utf8')) : {});
const guardarEstado = (parcial) => fs.writeFileSync(ARCHIVO_ESTADO, JSON.stringify({ ...leerEstado(), ...parcial }, null, 2));

/** Abre una URL del panel y espera a que cargue su título principal. */
async function irA(page, ruta, titulo) {
  await page.goto(ruta);
  if (titulo) await expect(page.getByRole('heading', { name: titulo }).first()).toBeVisible();
}

/** Ejecuta la acción que descarga un PDF y devuelve su nombre y contenido. */
async function descargarPdf(page, accion) {
  const [descarga] = await Promise.all([page.waitForEvent('download'), accion()]);
  const contenido = fs.readFileSync(await descarga.path());
  expect(contenido.subarray(0, 4).toString(), 'el archivo descargado es un PDF').toBe('%PDF');
  return { nombre: descarga.suggestedFilename(), contenido };
}

module.exports = {
  descargarPdf,
  credenciales, fechaEcuador, unico, cedulaValida, cedulaNueva, iniciarSesion, dialogo, aviso, leerEstado, guardarEstado, irA, ZONA
};
