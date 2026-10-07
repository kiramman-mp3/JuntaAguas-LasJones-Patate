import { Pipe, PipeTransform } from '@angular/core';
import { FormatoFecha, formatearFecha } from '../../core/utils/fechas';

/**
 * Muestra fechas del backend sin el desfase de zona horaria del pipe `date`:
 * `{{ evento.fecha | fechaLocal }}` o `{{ pago.fecha_pago | fechaLocal:'conHora' }}`.
 */
@Pipe({ name: 'fechaLocal', standalone: true })
export class FechaLocalPipe implements PipeTransform {
  transform(valor: string | Date | null | undefined, formato: FormatoFecha = 'corta'): string {
    return formatearFecha(valor, formato);
  }
}
