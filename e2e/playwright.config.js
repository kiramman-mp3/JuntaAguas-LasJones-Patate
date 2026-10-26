const { defineConfig, devices } = require('@playwright/test');
const { PUERTO } = require('./entorno');

// En local se usa el Edge o Chrome ya instalado (E2E_CHANNEL=msedge|chrome) para no descargar un navegador.
// En CI se instala Chromium con "npm run browsers".
const channel = process.env.E2E_CHANNEL || undefined;

module.exports = defineConfig({
  testDir: './tests',
  globalSetup: require.resolve('./global-setup'),
  // Todos los flujos comparten una sola base sembrada: se ejecutan en orden, uno a la vez.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PUERTO}`,
    locale: 'es-EC',
    timezoneId: 'America/Guayaquil',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  projects: [
    { name: 'login', testMatch: /auth\.setup\.js/, use: { ...devices['Desktop Chrome'], channel } },
    {
      name: 'flujos',
      testIgnore: /auth\.setup\.js/,
      dependencies: ['login'],
      use: { ...devices['Desktop Chrome'], channel, storageState: require('./entorno').ARCHIVO_SESION }
    }
  ]
});
