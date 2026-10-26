const fs = require('fs');
const { test, expect } = require('@playwright/test');
const { ARCHIVO_SESION, ARCHIVO_CREDENCIALES } = require('../entorno');

test('el administrador inicia sesión y se guarda la sesión', async ({ page }) => {
  const { admin, password } = JSON.parse(fs.readFileSync(ARCHIVO_CREDENCIALES, 'utf8'));

  await page.goto('/login');
  await page.getByLabel('Usuario o Cédula').fill(admin.cedula);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  // Con "Recordar mi sesión" el token va a localStorage y Playwright puede reutilizarlo.
  await page.getByLabel('Recordar mi sesión').check();
  await page.getByRole('button', { name: 'Ingresar al Sistema' }).click();

  await expect(page).toHaveURL(/\/admin/);
  await page.context().storageState({ path: ARCHIVO_SESION });
});
