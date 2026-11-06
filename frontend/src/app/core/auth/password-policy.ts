/**
 * Política de contraseñas, la misma que aplica el backend (backend/src/shared/passwords.js).
 * Validarla aquí evita un viaje al servidor y muestra el motivo antes de enviar.
 */
const LARGO_MINIMO = 10;
// Misma lista que el backend: contraseñas que se prueban primero en cualquier ataque y términos del sistema.
const COMUNES = new Set([
  'password',
  'contrasena',
  'qwerty',
  'qwertyuiop',
  'asdfghjkl',
  'admin',
  'administrador',
  'abcdefgh',
  'abcdefghij',
  'letmein',
  'welcome',
  'bienvenido',
  'junta',
  'juntalajones',
  'lajones',
  'patate',
  'ecuador',
  'tungurahua',
  'agua',
  'riego',
  'iloveyou',
  'monkey',
  'dragon',
]);

export const REQUISITOS_PASSWORD =
  'Mínimo 10 caracteres, con letras y números, sin incluir su cédula ni ser una contraseña común.';

/** Devuelve el motivo por el que la contraseña no es válida, o null si cumple la política. */
export function problemaConPassword(
  clave: string,
  { cedula, actual }: { cedula?: string; actual?: string } = {},
): string | null {
  if (typeof clave !== 'string' || clave.length < LARGO_MINIMO)
    return `La contraseña debe tener al menos ${LARGO_MINIMO} caracteres.`;
  if (clave.length > 72) return 'La contraseña no puede superar 72 caracteres.';
  if (!/[A-Za-z]/.test(clave) || !/\d/.test(clave))
    return 'La contraseña debe combinar letras y números.';
  if (cedula && clave.includes(cedula))
    return 'La contraseña no puede contener su número de cédula.';
  if (COMUNES.has(clave.toLowerCase().replace(/[^a-z]/g, '')))
    return 'La contraseña es demasiado común. Elija una menos predecible.';
  if (actual && clave === actual) return 'La nueva contraseña debe ser distinta de la actual.';
  return null;
}
