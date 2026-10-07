/**
 * Aritmética de dinero en centavos enteros. Restar importes en coma flotante da resultados como
 * 0.30 - 0.20 = 0.09999999999999998; en centavos (30 - 20 = 10) la suma y la resta son exactas.
 * Los importes de la base son DECIMAL(…,2) y mysql2 los entrega como Number (decimalNumbers).
 */

/** Importe en dólares (Number o texto decimal con hasta 2 decimales) a centavos enteros. */
function aCentavos(monto) {
  const centavos = Math.round(Number(monto) * 100);
  if (!Number.isSafeInteger(centavos)) throw new TypeError(`Monto inválido: ${monto}`);
  return centavos;
}

/** Centavos enteros a dólares. */
function aDolares(centavos) {
  return centavos / 100;
}

/** Diferencia exacta entre dos importes, en dólares. */
function restarMontos(a, b) {
  return aDolares(aCentavos(a) - aCentavos(b));
}

module.exports = { aCentavos, aDolares, restarMontos };
