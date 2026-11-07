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

/** Nombre con el que el usuario conoce cada dato que la API valida. */
const ETIQUETAS_CAMPO: Record<string, string> = {
  cedula: 'Cédula',
  nombres: 'Nombres',
  apellidos: 'Apellidos',
  celular: 'Celular',
  telefono: 'Teléfono',
  email: 'Correo electrónico',
  direccion: 'Dirección',
  fecha_nacimiento: 'Fecha de nacimiento',
  titulo: 'Título',
  descripcion: 'Descripción',
  fecha: 'Fecha',
  hora_inicio: 'Hora de inicio',
  hora_fin: 'Hora de fin',
  lugar: 'Lugar',
  valor: 'Valor',
  concepto: 'Concepto',
  concepto_id: 'Concepto',
  referencia: 'Referencia',
  observacion: 'Observación',
  observaciones: 'Observaciones',
  proveedor: 'Proveedor',
  ruc_proveedor: 'RUC o cédula del proveedor',
  numero_factura: 'Número de factura',
  motivo: 'Motivo',
  vigencia_desde: 'Fecha desde la que rige',
  sector_id: 'Sector',
  persona_id: 'Usuario',
  lote_id: 'Lote',
  password: 'Contraseña',
};

/** Textos en inglés que el validador de la API deja pasar, traducidos a lenguaje cotidiano. */
function traducirDetalle(detalle: string): string {
  if (/^required$/i.test(detalle) || /received undefined/i.test(detalle)) return 'es obligatorio.';
  if (/^invalid input/i.test(detalle) || /^invalid/i.test(detalle) || /^expected/i.test(detalle)) {
    return 'no tiene un valor válido.';
  }
  return detalle;
}

/**
 * Mensaje de error de la API listo para una persona sin conocimientos técnicos:
 * - sin respuesta del servidor (sin internet o servidor apagado) y errores 5xx y 429 se explican
 *   con qué hacer, sin códigos ni "Error interno del servidor";
 * - un error de validación `campo_tecnico: detalle` pasa a `Nombre del dato: detalle`.
 * Cualquier otro mensaje ya redactado por la API se deja tal cual.
 */
export function mensajeAmigable(status: number, mensaje: string | undefined): string | undefined {
  if (status === 0) {
    return 'No hay conexión con el servidor. Revise su conexión a internet e inténtelo de nuevo.';
  }
  if (status === 429) {
    return (
      mensaje || 'Hizo demasiados intentos seguidos. Espere unos minutos e inténtelo de nuevo.'
    );
  }
  if (status >= 500) {
    return 'El sistema tuvo un problema y no pudo completar la acción. Inténtelo de nuevo en unos minutos; si el problema continúa, avise a la directiva.';
  }
  const campo = mensaje?.match(/^([a-z][a-z0-9_]*(?:\.[a-z0-9_]+)*): (.+)$/);
  if (!campo) return mensaje;
  const nombre = campo[1].split('.').pop() ?? campo[1];
  const etiqueta =
    ETIQUETAS_CAMPO[nombre] ??
    nombre.replace(/_/g, ' ').replace(/^./, (letra) => letra.toUpperCase());
  const detalle = traducirDetalle(campo[2]);
  return /^[a-záéíóúñ]/.test(detalle) ? `${etiqueta} ${detalle}` : `${etiqueta}: ${detalle}`;
}
