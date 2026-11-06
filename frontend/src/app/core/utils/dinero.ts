const FORMATO = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Importe en dólares con separador de miles y dos decimales: 8301 → "$8,301.00", -5 → "-$5.00".
 * Un valor vacío o no numérico se muestra como "$0.00" en lugar de "NaN".
 */
export function formatearDinero(valor: number | string | null | undefined): string {
  const numero = Number(valor ?? 0);
  return FORMATO.format(Number.isFinite(numero) ? numero : 0);
}
