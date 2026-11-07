import { DestroyRef, Directive, ElementRef, HostListener, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NgControl, ValidationErrors } from '@angular/forms';

let siguienteId = 0;

/** Mensaje en lenguaje cotidiano para el primer validador de Angular que falla. */
export function mensajeValidacion(
  errores: ValidationErrors,
  campo: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
): string {
  if (errores['required']) {
    if (campo.dataset['errorRequired']) return campo.dataset['errorRequired'];
    if (campo instanceof HTMLSelectElement) return 'Seleccione una opción de la lista.';
    if (campo instanceof HTMLInputElement && ['date', 'time', 'month'].includes(campo.type)) {
      return campo.type === 'time' ? 'Indique la hora.' : 'Indique la fecha.';
    }
    return 'Este dato es obligatorio.';
  }
  if (errores['email']) return 'Escriba un correo válido. Ej. usuario@correo.com';
  if (errores['minlength']) {
    return `Debe tener al menos ${errores['minlength'].requiredLength} caracteres.`;
  }
  if (errores['maxlength']) {
    return `No puede tener más de ${errores['maxlength'].requiredLength} caracteres.`;
  }
  if (errores['min']) return `El valor mínimo es ${errores['min'].min}.`;
  if (errores['max']) return `El valor máximo es ${errores['max'].max}.`;
  if (errores['pattern']) {
    return campo.dataset['errorPattern'] ?? 'El formato no es válido. Revise lo que escribió.';
  }
  return 'El dato ingresado no es válido.';
}

/**
 * Muestra bajo cada campo con `ngModel` por qué no es válido, en cuanto el usuario lo abandona
 * (o intenta enviar el formulario). No cambia el contenido del campo ni requiere marcado extra:
 * se aplica solo a todo `input`, `select` y `textarea` con `ngModel`.
 * Un campo puede dar su propio texto con `data-error-required` y `data-error-pattern`.
 */
// Se aplica a los elementos nativos sin marcado extra: no lleva el prefijo `app` a propósito.
/* eslint-disable @angular-eslint/directive-selector */
@Directive({
  selector:
    'input[ngModel]:not([type=checkbox]):not([type=radio]):not([type=file]), select[ngModel], textarea[ngModel]',
  standalone: true,
})
export class CampoErrorDirective {
  private readonly control = inject(NgControl, { self: true });
  private readonly el =
    inject<ElementRef<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>>(ElementRef);
  private aviso: HTMLElement | null = null;
  private readonly idAviso = `campo-error-${++siguienteId}`;
  private idsPrevios: string | null = null;

  constructor() {
    this.control.control?.events
      .pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe(() => this.actualizar());
    inject(DestroyRef).onDestroy(() => this.aviso?.remove());
  }

  @HostListener('blur')
  protected alSalir(): void {
    // `touched` se marca en este mismo evento, pero otro oyente puede correr después.
    queueMicrotask(() => this.actualizar());
  }

  private actualizar(): void {
    const control = this.control.control;
    if (!control) return;
    const campo = this.el.nativeElement;
    const mostrar = control.invalid && control.touched && !campo.disabled;
    if (!mostrar) {
      this.quitar();
      return;
    }
    const texto = mensajeValidacion(control.errors ?? {}, campo);
    if (!this.aviso) {
      this.aviso = document.createElement('span');
      this.aviso.id = this.idAviso;
      this.aviso.className = 'field__error';
      this.insertar(this.aviso);
      this.idsPrevios = campo.getAttribute('aria-describedby');
      campo.setAttribute(
        'aria-describedby',
        [this.idsPrevios, this.idAviso].filter(Boolean).join(' '),
      );
      campo.setAttribute('aria-invalid', 'true');
    }
    if (this.aviso.textContent !== texto) this.aviso.textContent = texto;
  }

  private quitar(): void {
    if (!this.aviso) return;
    const campo = this.el.nativeElement;
    this.aviso.remove();
    this.aviso = null;
    if (this.idsPrevios) campo.setAttribute('aria-describedby', this.idsPrevios);
    else campo.removeAttribute('aria-describedby');
    campo.removeAttribute('aria-invalid');
  }

  /** El aviso va debajo del campo; si el campo vive en un envoltorio (p. ej. con botón de ojo), debajo del envoltorio. */
  private insertar(aviso: HTMLElement): void {
    const campo = this.el.nativeElement;
    const envoltorio = campo.closest('.password-input-wrapper, .input-group');
    const referencia = envoltorio ?? campo;
    referencia.insertAdjacentElement('afterend', aviso);
  }
}
