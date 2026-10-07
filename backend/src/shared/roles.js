/**
 * El sistema tiene dos roles:
 * - ADMIN: la directiva de la Junta; gestiona todo el sistema.
 * - USUARIO: el comunero; consulta únicamente su propia información.
 */
const ROLES = Object.freeze({
  ADMIN: 'ADMIN',
  USUARIO: 'USUARIO'
});

const esAdmin = (user) => Boolean(user) && user.rol === ROLES.ADMIN;

/**
 * Devuelve el persona_id que un usuario puede consultar:
 * el administrador puede ver a cualquiera (o a quien pida); un comunero solo a sí mismo.
 */
function personaPermitida(user, personaSolicitada) {
  if (esAdmin(user)) return personaSolicitada ?? null;
  return user.personaId;
}

module.exports = { ROLES, esAdmin, personaPermitida };
