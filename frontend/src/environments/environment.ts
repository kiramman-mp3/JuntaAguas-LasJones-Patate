// Configuración de desarrollo (ng serve).
// En `ng build` (producción) se reemplaza por environment.prod.ts (ver angular.json → fileReplacements).
export const environment = {
  production: false,
  // Origen del backend: se usa para abrir archivos subidos (/uploads/...) y PDFs.
  serverUrl: 'http://localhost:3000',
  // Base de la API REST.
  apiUrl: 'http://localhost:3000/api'
};
