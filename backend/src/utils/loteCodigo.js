// Convención existente en el catastro: LJA-001, ELT-002, etc.
const FORMATO_CODIGO_LOTE = /^[A-Z]{3}-\d{3,8}$/;

function normalizarCodigo(codigo) {
  return typeof codigo === "string" ? codigo.trim().toUpperCase() : "";
}

function prefijoSector(nombre, codigos = []) {
  const frecuencias = new Map();
  for (const codigo of codigos) {
    const normalizado = normalizarCodigo(codigo);
    if (FORMATO_CODIGO_LOTE.test(normalizado)) {
      const prefijo = normalizado.slice(0, 3);
      frecuencias.set(prefijo, (frecuencias.get(prefijo) || 0) + 1);
    }
  }
  if (frecuencias.size) {
    return [...frecuencias].sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
    )[0][0];
  }
  const palabras =
    nombre
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .match(/[A-Z]+/g) || [];
  const iniciales =
    palabras.length > 1
      ? palabras.map((p) => p[0]).join("")
      : palabras[0] || "LOT";
  return iniciales.slice(0, 3).padEnd(3, "X");
}

module.exports = { FORMATO_CODIGO_LOTE, normalizarCodigo, prefijoSector };
