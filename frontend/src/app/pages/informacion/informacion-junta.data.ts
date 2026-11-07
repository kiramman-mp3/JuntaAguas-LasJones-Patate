/**
 * Contenido de la página "Información de la Junta".
 *
 * Los textos de quiénes somos, órganos de dirección, misión y directiva los proporcionó la Junta.
 * El horario y el contacto siguen siendo provisionales hasta que se confirmen. Para actualizar
 * cualquiera basta con editar este archivo; la página no necesita otros cambios.
 */
import { NOMBRES_DIRECTIVA } from '../../core/utils/directiva';

export interface MiembroDirectiva {
  cargo: string;
  titulo: string;
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
    'Junta de Riego creada en 2019 para administrar el agua del río Patate en los sectores de ' +
    'Patate Viejo, La Merced y San Javier.',
  quienesSomos:
    'Somos una Junta de Riego creada el año 2019 por exigencia de la Ley Orgánica de Recursos ' +
    'Hídricos, con el fin de administrar la concesión de agua de riego proveniente del río ' +
    'Patate, otorgada el año 2018 y que beneficia a los sectores de Patate Viejo, La Merced y ' +
    'San Javier del cantón Patate.',
  organos: {
    asamblea:
      'La máxima autoridad de la Junta es la Asamblea General de Usuarios, la misma que se reúne ' +
      'dos veces al año.',
    directiva:
      'El máximo organismo de administración es la Directiva, que elige la Asamblea cada dos ' +
      'años. En la actualidad la Directiva está conformada por:',
    vocales: 'Más 3 vocales principales y 3 vocales suplentes.',
  },
  mision:
    'Coadyuvar al desarrollo regional y nacional mediante la administración eficiente y la ' +
    'protección del agua de riego como recurso vital, para favorecer el mejoramiento de las ' +
    'condiciones de vida de los usuarios, sus familias y la población en general, a través del ' +
    'fomento de la agricultura, fruticultura y demás actividades relacionadas propias de la zona.',
  directiva: [
    { cargo: 'Presidente', ...NOMBRES_DIRECTIVA.presidente, icono: 'ri-user-star-line' },
    {
      cargo: 'Vicepresidente',
      titulo: 'Sr.',
      nombre: 'Gilberto Carvajal',
      icono: 'ri-user-line',
    },
    { cargo: 'Secretario', ...NOMBRES_DIRECTIVA.secretario, icono: 'ri-quill-pen-line' },
    { cargo: 'Tesorera', titulo: 'Ing.', nombre: 'Natalia Barrera', icono: 'ri-wallet-3-line' },
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
