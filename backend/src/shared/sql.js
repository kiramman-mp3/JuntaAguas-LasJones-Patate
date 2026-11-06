/** Patrón LIKE "contiene" con los comodines del usuario (\, % y _) escapados para que se busquen tal cual. */
function patronContiene(texto) {
  return `%${String(texto).replace(/[\\%_]/g, '\\$&')}%`;
}

module.exports = { patronContiene };
