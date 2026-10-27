const { test, expect } = require('@playwright/test');
const { cedulaNueva, unico, iniciarSesion, aviso, guardarEstado, leerEstado, credenciales, crearUsuarioConCuenta, abrirEdicion, dialogo } = require('./ayudas');

const CLAVE_NUEVA = 'NuevaClave2026';
const CLAVE_NUEVA_2 = 'OtraClave2027x';
const SIN_SESION = { cookies: [], origins: [] };

// Un mismo usuario recorre todo su ciclo de vida: alta, primer ingreso, bloqueo, restablecimiento y baja.
test.describe.configure({ mode: 'serial' });

test.describe('administración de usuarios', () => {
  test('crear un usuario con cuenta muestra una sola vez su contraseña temporal', async ({ page }) => {
    const nombres = unico('Prueba');
    const cedula = cedulaNueva();
    await page.goto('/admin/usuarios/padron');
    await page.getByRole('button', { name: 'Nuevo usuario' }).click();

    await page.getByLabel('Cédula *').fill(cedula);
    await page.getByLabel('Nombres *').fill(nombres);
    await page.getByLabel('Apellidos *').fill('Usuario E2E');
    await page.getByLabel('Celular').fill('0991234567');
    await page.getByLabel('Correo electrónico').fill('prueba.e2e@ejemplo.com');
    await page.getByLabel('Generar cuenta de acceso para este usuario').check();
    await page.getByRole('button', { name: 'Guardar' }).click();

    await expect(aviso(page, 'Usuario registrado.')).toBeVisible();
    const clave = page.getByTestId('password-temporal');
    await expect(clave).toBeVisible();
    const passwordTemporal = (await clave.innerText()).trim();
    expect(passwordTemporal.length).toBeGreaterThanOrEqual(8);
    await expect(page.getByText('Se muestra una sola vez.')).toBeVisible();
    await page.getByRole('button', { name: 'Ya la anoté' }).click();
    await expect(clave).toBeHidden();

    guardarEstado({ nuevo: { cedula, nombres, apellidos: 'Usuario E2E', passwordTemporal } });

    // Aparece en el padrón.
    await page.getByLabel('Buscar usuario').fill(cedula);
    const fila = page.getByRole('row').filter({ hasText: cedula });
    await expect(fila).toHaveCount(1);
    await expect(fila).toContainText(nombres);
    await expect(fila).toContainText('Activo');
  });

  test('el formulario rechaza una cédula inválida y una cédula repetida', async ({ page }) => {
    const { nuevo } = leerEstado();
    await page.goto('/admin/usuarios/padron');

    await page.getByRole('button', { name: 'Nuevo usuario' }).click();
    await page.getByLabel('Cédula *').fill('1801234560');
    await page.getByLabel('Nombres *').fill('Inválida');
    await page.getByLabel('Apellidos *').fill('Prueba');
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.locator('.toast--error, .toast--danger').first()).toBeVisible();
    await expect(page.getByLabel('Cédula *')).toBeVisible(); // el formulario sigue abierto

    await page.getByLabel('Cédula *').fill(nuevo.cedula);
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.locator('.toast--error, .toast--danger').last()).toBeVisible();
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByLabel('Cédula *')).toBeHidden();
  });

  test('el padrón filtra por texto, sector y estado y pagina los resultados', async ({ page }) => {
    const { nuevo } = leerEstado();
    await page.goto('/admin/usuarios/padron');
    const filas = page.locator('tbody tr');
    await expect(filas.first()).toBeVisible();
    const total = await filas.count();
    expect(total).toBeGreaterThan(1);

    await page.getByLabel('Buscar usuario').fill(nuevo.nombres);
    await expect(filas).toHaveCount(1);
    await page.getByLabel('Buscar usuario').fill('zzzz-no-existe');
    await expect(page.getByText('Sin coincidencias')).toBeVisible();
    await page.getByRole('button', { name: 'Limpiar filtros' }).click();
    await expect(filas.first()).toBeVisible();

    await page.getByLabel('Estado').selectOption({ label: 'Inactivos' });
    await expect(page.locator('tbody tr .badge--danger').first()).toBeVisible();
    await expect(page.locator('tbody tr .badge--success')).toHaveCount(0);
    await page.getByLabel('Estado').selectOption({ index: 0 });

    const sectores = await page.getByLabel('Sector').locator('option').allInnerTexts();
    expect(sectores.length).toBeGreaterThan(1);
    await page.getByLabel('Sector').selectOption({ index: 1 });
    await expect(filas.first()).toBeVisible();

    await page.getByLabel('Registros por página').selectOption({ index: 0 });
    expect(await filas.count()).toBeLessThanOrEqual(total);
  });
});

test.describe('primer ingreso del usuario nuevo', () => {
  test.use({ storageState: SIN_SESION });

  test('con la contraseña temporal solo puede elegir una contraseña nueva válida', async ({ page }) => {
    const { nuevo } = leerEstado();
    await iniciarSesion(page, { cedula: nuevo.cedula, password: nuevo.passwordTemporal });

    await expect(page.getByText('Contraseña temporal').first()).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
    // Mientras no cambie la contraseña, no puede entrar a ninguna parte.
    await page.goto('/mi-cuenta');
    await expect(page).toHaveURL(/\/login/);
    // Según el estado guardado, el formulario vuelve a pedir la cédula o sigue en el cambio de contraseña.
    const campoUsuario = page.getByLabel('Usuario o Cédula');
    const campoTemporal = page.getByLabel('Contraseña temporal');
    await expect(campoUsuario.or(campoTemporal)).toBeVisible();
    if (await campoUsuario.isVisible()) {
      await iniciarSesion(page, { cedula: nuevo.cedula, password: nuevo.passwordTemporal });
    }

    const enviar = () => page.getByRole('button', { name: 'Cambiar Contraseña' }).click();
    await page.getByLabel('Contraseña temporal').fill(nuevo.passwordTemporal);

    await page.getByLabel('Nueva Contraseña').fill('corta1');
    await page.getByLabel('Confirmar Contraseña').fill('corta1');
    await enviar();
    await expect(page.getByRole('alert')).toContainText(/8 caracteres|contraseña/i);

    await page.getByLabel('Nueva Contraseña').fill(CLAVE_NUEVA);
    await page.getByLabel('Confirmar Contraseña').fill('Distinta2026x');
    await enviar();
    await expect(page.getByRole('alert')).toContainText('no coinciden');

    await page.getByLabel('Confirmar Contraseña').fill(CLAVE_NUEVA);
    await enviar();
    await expect(page.getByText('Contraseña actualizada')).toBeVisible();
    await expect(page).toHaveURL(/\/mi-cuenta/);
    await expect(page.getByText(`Cédula: ${nuevo.cedula}`)).toBeVisible();
  });

  test('la contraseña temporal deja de servir y la nueva funciona', async ({ page }) => {
    const { nuevo } = leerEstado();
    await iniciarSesion(page, { cedula: nuevo.cedula, password: nuevo.passwordTemporal });
    await expect(page.getByRole('alert')).toContainText('Credenciales incorrectas');

    await iniciarSesion(page, { cedula: nuevo.cedula, password: CLAVE_NUEVA });
    await expect(page).toHaveURL(/\/mi-cuenta/);
    await expect(page.getByText('Mi Cuenta y Estado de Obligaciones')).toBeVisible();
  });

  test('cerrar sesión devuelve al inicio y la sesión no se puede reanudar', async ({ page }) => {
    const { nuevo } = leerEstado();
    await iniciarSesion(page, { cedula: nuevo.cedula, password: CLAVE_NUEVA });
    await expect(page).toHaveURL(/\/mi-cuenta/);

    await page.getByRole('button', { name: 'Cerrar Sesión' }).first().click();
    await expect(page).not.toHaveURL(/\/mi-cuenta/);
    await page.goto('/mi-cuenta');
    await expect(page).toHaveURL(/\/login/);
  });

  test('un usuario común no entra al panel ni a la API de administración', async ({ page, request }) => {
    const { nuevo } = leerEstado();
    await iniciarSesion(page, { cedula: nuevo.cedula, password: CLAVE_NUEVA });
    await expect(page).toHaveURL(/\/mi-cuenta/);

    await page.goto('/admin/dashboard');
    await expect(page).not.toHaveURL(/\/admin/);
    await page.goto('/admin/cobros/cobrar');
    await expect(page).not.toHaveURL(/\/admin/);

    const token = await page.evaluate(() => localStorage.getItem('junta_token') ?? sessionStorage.getItem('junta_token'));
    expect(token).toBeTruthy();
    const cabeceras = { Authorization: `Bearer ${token}` };
    for (const ruta of ['/api/personas', '/api/auditoria', '/api/inventario', '/api/financiero/tarifas', '/api/dashboard/resumen']) {
      const r = await request.get(ruta, { headers: cabeceras });
      expect(r.status(), ruta).toBe(403);
    }
  });

  test('demasiados intentos desde una misma cédula activan el límite de velocidad', async ({ request }) => {
    const cedula = cedulaNueva(); // cédula sin cuenta: no bloquea a nadie real
    let ultimo;
    for (let n = 0; n < 11; n += 1) {
      ultimo = await request.post('/api/auth/login', { data: { cedula, password: `Intento${n}abcd` } });
    }
    expect(ultimo.status()).toBe(429);
    expect((await ultimo.json()).message).toContain('Demasiados intentos');
  });
});

test.describe('bloqueo de cuenta y restablecimiento', () => {
  test.use({ storageState: SIN_SESION });

  test('cinco contraseñas erróneas bloquean la cuenta aun con la contraseña correcta', async ({ page, request }) => {
    const bloqueable = await crearUsuarioConCuenta(request);
    guardarEstado({ bloqueable });
    await page.context().clearCookies();
    for (let n = 0; n < 5; n += 1) {
      await iniciarSesion(page, { cedula: bloqueable.cedula, password: `Incorrecta${n}x` });
      await expect(page.getByRole('alert')).toContainText('Credenciales incorrectas');
    }
    // Con la contraseña correcta tampoco entra: la cuenta está bloqueada 15 minutos.
    await iniciarSesion(page, { cedula: bloqueable.cedula, password: bloqueable.passwordTemporal });
    await expect(page.getByRole('alert')).toContainText('bloqueada temporalmente');
    await expect(page.getByLabel('Contraseña temporal')).toHaveCount(0);
  });
});

test.describe('restablecimiento y baja', () => {
  test.use({ storageState: require('../entorno').ARCHIVO_SESION });

  test('el administrador restablece la contraseña y levanta el bloqueo', async ({ page }) => {
    const { bloqueable } = leerEstado();
    await abrirEdicion(page, bloqueable.cedula);
    await page.getByRole('button', { name: 'Restablecer contraseña' }).click();
    await dialogo(page).getByRole('button', { name: 'Restablecer', exact: true }).click();

    const clave = page.getByTestId('password-temporal');
    await expect(clave).toBeVisible();
    const nueva = (await clave.innerText()).trim();
    expect(nueva).not.toBe(bloqueable.passwordTemporal);
    await page.getByRole('button', { name: 'Ya la anoté' }).click();
    guardarEstado({ bloqueable: { ...bloqueable, passwordTemporal: nueva } });
  });

  test('el usuario entra con la temporal nueva y vuelve a elegir su contraseña', async ({ browser }) => {
    const { bloqueable } = leerEstado();
    const contexto = await browser.newContext({ storageState: SIN_SESION });
    const page = await contexto.newPage();
    await page.goto('http://127.0.0.1:3210/login');
    await iniciarSesionEn(page, bloqueable.cedula, bloqueable.passwordTemporal);
    // Recién ingresada, la temporal ya se conoce: el formulario solo pide la contraseña nueva.
    await expect(page.getByText('Está usando una contraseña temporal')).toBeVisible();
    await page.getByLabel('Nueva Contraseña').fill(CLAVE_NUEVA_2);
    await page.getByLabel('Confirmar Contraseña').fill(CLAVE_NUEVA_2);
    await page.getByRole('button', { name: 'Cambiar Contraseña' }).click();
    await expect(page).toHaveURL(/\/mi-cuenta/);
    await contexto.close();
  });

  test('desactivar al usuario le impide iniciar sesión; reactivarlo se lo devuelve', async ({ page, browser }) => {
    const { nuevo } = leerEstado();
    const cambiarEstado = async (opcion) => {
      await abrirEdicion(page, nuevo.cedula);
      await page.locator('#com-estado').selectOption({ label: opcion });
      await page.getByRole('button', { name: 'Guardar' }).click();
      await expect(aviso(page, 'Usuario actualizado.')).toBeVisible();
    };

    await cambiarEstado('Inactivo');
    const contexto = await browser.newContext({ storageState: SIN_SESION });
    const anonima = await contexto.newPage();
    await anonima.goto('http://127.0.0.1:3210/login');
    await iniciarSesionEn(anonima, nuevo.cedula, CLAVE_NUEVA);
    await expect(anonima.getByRole('alert')).toContainText('Credenciales incorrectas');

    await cambiarEstado('Activo');
    await iniciarSesionEn(anonima, nuevo.cedula, CLAVE_NUEVA);
    await expect(anonima).toHaveURL(/\/mi-cuenta/);
    await contexto.close();
  });

  test('el usuario sembrado de demostración inicia sesión con las credenciales del seed', async ({ browser }) => {
    const { usuario, password } = credenciales();
    const contexto = await browser.newContext({ storageState: SIN_SESION });
    const page = await contexto.newPage();
    await page.goto('http://127.0.0.1:3210/login');
    await iniciarSesionEn(page, usuario.cedula, password);
    await expect(page).toHaveURL(/\/mi-cuenta/);
    await contexto.close();
  });
});

async function iniciarSesionEn(page, cedula, password) {
  await page.getByLabel('Usuario o Cédula').fill(cedula);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Ingresar al Sistema' }).click();
}
