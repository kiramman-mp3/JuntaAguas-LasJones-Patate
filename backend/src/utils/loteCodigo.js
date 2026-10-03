// Convención existente en el catastro: LJA-001, ELT-002, etc.
const FORMATO_CODIGO_LOTE = /^[A-Z]{3}-\d{3,8}$/;

function normalizarCodigo(codigo) {
  return typeof codigo === "string" ? codigo.trim().toUpperCase() : "";
}

// Alias de los dos catálogos semilla. No depende de IDs ni del número de lotes.
const PREFIJOS_SECTOR = Object.freeze({
  'LA JONES ALTA': 'LJA', 'LA JONES ALTO': 'LJA', 'LAS JONES ALTO': 'LJA',
  'LA JONES BAJA': 'LJB', 'LA JONES BAJO': 'LJB', 'LAS JONES BAJO': 'LJB',
  'LAS JONES CENTRO': 'LJC', 'EL TAMBO': 'ELT', 'LOS CUYES': 'LCU',
});

function prefijoSector(nombre) {
  const palabras =
    nombre
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/^SECTOR\s+/, '')
      .match(/[A-Z]+/g) || [];
  const fijo = PREFIJOS_SECTOR[palabras.join(' ')];
  if (fijo) return fijo;
  const iniciales =
    palabras.length > 1
      ? palabras.map((p) => p[0]).join("")
      : palabras[0] || "LOT";
  return iniciales.slice(0, 3).padEnd(3, "X");
}

module.exports = { FORMATO_CODIGO_LOTE, normalizarCodigo, prefijoSector };
