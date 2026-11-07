import { Directive, ElementRef, HostListener, inject, input } from '@angular/core';

export type TipoMascara = 'cedula' | 'celular' | 'telefono' | 'numero';

/** Dígitos máximos de cada dato; el servidor exige exactamente estos largos. */
const LARGO_MAXIMO: Record<TipoMascara, number> = {
  cedula: 10,
  celular: 10,
  telefono: 9,
  numero: 20,
};

/** Deja solo los dígitos que caben en el dato; lo demás (letras, espacios, guiones) se descarta al escribir o pegar. */
export function aplicarMascara(valor: string, tipo: TipoMascara): string {
  return valor.replace(/\D/g, '').slice(0, LARGO_MAXIMO[tipo]);
}

/**
 * Máscara de entrada para datos numéricos de largo fijo (cédula, celular, teléfono).
 * Impide escribir caracteres que el dato nunca aceptará, en vez de avisar después.
 * Funciona con `ngModel` porque vuelve a emitir `input` cuando corrige el texto.
 */
@Directive({
  selector: 'input[appMascara]',
  standalone: true,
  host: { inputmode: 'numeric' },
})
export class MascaraDirective {
  private readonly el = inject<ElementRef<HTMLInputElement>>(ElementRef);

  readonly appMascara = input.required<TipoMascara>();

  @HostListener('input')
  protected alEscribir(): void {
    const campo = this.el.nativeElement;
    const limpio = aplicarMascara(campo.value, this.appMascara());
    if (limpio === campo.value) return;
    campo.value = limpio;
    // El valor cambió después de que otros oyentes lo leyeron: se avisa de nuevo con el texto limpio.
    campo.dispatchEvent(new Event('input', { bubbles: true }));
  }
}
