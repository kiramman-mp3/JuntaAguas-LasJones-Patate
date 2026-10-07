// Configuración de producción (ng build).
// El backend sirve esta aplicación desde su mismo origen, así que la API es relativa:
// funciona con cualquier dominio o IP sin recompilar y sin configurar CORS.
export const environment = {
  production: true,
  serverUrl: '',
  apiUrl: '/api'
};
