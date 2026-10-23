/** Cuerpo de error que devuelve la API: { status: 'ERROR', message, codigo? }. */
export interface CuerpoError {
  message?: string;
  codigo?: string;
}

/** Cuerpo de error de una respuesta HTTP fallida, o undefined si no lo hay. */
export function cuerpoError(err: unknown): CuerpoError | undefined {
  const cuerpo = (err as { error?: unknown } | null)?.error;
  return cuerpo && typeof cuerpo === 'object' ? (cuerpo as CuerpoError) : undefined;
}

/** Mensaje para mostrar al usuario: el que envió la API o `porDefecto`. */
export function mensajeError(err: unknown, porDefecto: string): string {
  return cuerpoError(err)?.message || porDefecto;
}
