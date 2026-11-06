import { Pipe, PipeTransform } from '@angular/core';
import { formatearDinero } from '../../core/utils/dinero';

/** Importe en dólares con miles y dos decimales: `{{ pago.valor_total | moneda }}` → "$8,301.00". */
@Pipe({ name: 'moneda', standalone: true })
export class MonedaPipe implements PipeTransform {
  transform(valor: number | string | null | undefined): string {
    return formatearDinero(valor);
  }
}
