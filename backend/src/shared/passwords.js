const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const COSTO_BCRYPT = 10;
// Sin caracteres ambiguos (0/O, 1/l/I) para dictarla por teléfono o anotarla a mano.
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

/** Contraseña temporal aleatoria con al menos una letra y un dígito. */
function generarPasswordTemporal(longitud = 10) {
  for (;;) {
    let clave = '';
    for (let i = 0; i < longitud; i++) clave += ALFABETO[crypto.randomInt(ALFABETO.length)];
    if (/[A-Za-z]/.test(clave) && /\d/.test(clave)) return clave;
  }
}

/** Devuelve un mensaje de error si la contraseña no cumple la política, o null si es válida. */
function problemaConPassword(clave, { cedula } = {}) {
  if (typeof clave !== 'string' || clave.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
  if (clave.length > 72) return 'La contraseña no puede superar 72 caracteres.';
  if (!/[A-Za-z]/.test(clave) || !/\d/.test(clave)) return 'La contraseña debe combinar letras y números.';
  if (cedula && clave.includes(cedula)) return 'La contraseña no puede contener su número de cédula.';
  return null;
}

const hashPassword = (clave) => bcrypt.hash(clave, COSTO_BCRYPT);
const compararPassword = (clave, hash) => bcrypt.compare(clave, hash);

// Hash de referencia para igualar el tiempo de respuesta cuando la cédula no existe.
const HASH_FICTICIO = bcrypt.hashSync('cuenta-inexistente', COSTO_BCRYPT);

module.exports = { generarPasswordTemporal, problemaConPassword, hashPassword, compararPassword, HASH_FICTICIO };
