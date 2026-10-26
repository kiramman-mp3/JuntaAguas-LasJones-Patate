/** Iniciales para un monograma: primer nombre y primer apellido ("Luis Alberto Paredes Moreta" → "LP"). */
export function iniciales(nombre: string | null | undefined): string {
  const palabras = (nombre ?? '').trim().split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return '';
  if (palabras.length === 1) return palabras[0].slice(0, 2).toUpperCase();
  const apellido = palabras.length >= 4 ? palabras[2] : palabras[1];
  return (palabras[0][0] + apellido[0]).toUpperCase();
}
