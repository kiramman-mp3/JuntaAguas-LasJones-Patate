/**
 * Contenido de la página "Información de la Junta".
 *
 * DATOS PROVISIONALES: los nombres de la directiva, el horario y el contacto son de ejemplo
 * hasta que la Junta confirme la información real. Para actualizarlos basta con editar
 * este archivo; la página no necesita otros cambios.
 */

export interface MiembroDirectiva {
  cargo: string;
  nombre: string;
  icono: string;
}

export interface DatoContacto {
  etiqueta: string;
  valor: string;
  icono: string;
}

export const INFORMACION_JUNTA = {
  nombre: 'Junta de Agua y Riego "La Jones"',
  descripcion:
    'Organización comunitaria encargada de administrar el agua de riego del canal La Jones en el ' +
    'cantón Patate, provincia de Tungurahua. Coordina los turnos de agua, las mingas de ' +
    'mantenimiento y las asambleas de los comuneros.',
  mision:
    'Distribuir el agua de riego de forma equitativa, transparente y oportuna entre los comuneros, ' +
    'cuidando el canal y sus fuentes con el trabajo comunitario.',
  vision:
    'Ser una junta organizada y confiable, con un sistema de riego en buen estado que asegure la ' +
    'producción agrícola de las familias de la zona.',
  // TODO: reemplazar por los nombres reales cuando la Junta los confirme.
  directiva: [
    { cargo: 'Director', nombre: 'Luis Alberto Paredes Moreta', icono: 'ri-user-star-line' },
    { cargo: 'Secretario', nombre: 'Jorge Enrique Salazar Tamayo', icono: 'ri-quill-pen-line' },
  ] as MiembroDirectiva[],
  // TODO: confirmar horario y medios de contacto con la Junta.
  contacto: [
    {
      etiqueta: 'Dirección',
      valor: 'Casa Comunal Junta La Jones, cantón Patate, Tungurahua, Ecuador',
      icono: 'ri-map-pin-line',
    },
    { etiqueta: 'Atención', valor: 'Sábados de 08:00 a 12:00', icono: 'ri-time-line' },
    { etiqueta: 'Teléfono', valor: 'Por confirmar', icono: 'ri-phone-line' },
    { etiqueta: 'Correo', valor: 'Por confirmar', icono: 'ri-mail-line' },
  ] as DatoContacto[],
};
