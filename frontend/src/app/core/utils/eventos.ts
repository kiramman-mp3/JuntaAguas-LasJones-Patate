export interface SeccionEventos<T> {
  id: 'proximas' | 'anteriores';
  titulo: string;
  eventos: T[];
}

/**
 * Separa eventos (asambleas o mingas) en próximos —el más cercano primero— y anteriores
 * —el más reciente primero—. Omite los grupos vacíos. `hoy` es 'AAAA-MM-DD'.
 */
export function agruparPorFecha<T extends { fecha: string; hora_inicio?: string }>(eventos: T[], hoy: string): SeccionEventos<T>[] {
  const clave = (e: T) => `${e.fecha} ${e.hora_inicio ?? ''}`;
  const proximas = eventos.filter((e) => e.fecha >= hoy).sort((a, b) => clave(a).localeCompare(clave(b)));
  const anteriores = eventos.filter((e) => e.fecha < hoy).sort((a, b) => clave(b).localeCompare(clave(a)));
  const secciones: SeccionEventos<T>[] = [
    { id: 'proximas', titulo: 'Próximas', eventos: proximas },
    { id: 'anteriores', titulo: 'Anteriores', eventos: anteriores }
  ];
  return secciones.filter((s) => s.eventos.length);
}
