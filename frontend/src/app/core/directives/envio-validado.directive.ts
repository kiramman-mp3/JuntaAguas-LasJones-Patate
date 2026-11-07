import { Directive, ElementRef, OnDestroy, inject } from '@angular/core';
import { NgForm } from '@angular/forms';
import { NotificationService } from '../services/notification.service';

/**
 * Al enviar un formulario incompleto no deja pasar el envío en silencio: marca todos los campos
 * (para que cada uno explique qué falta), lleva el foco al primero que hay que corregir y avisa.
 * Así el botón de guardar puede estar siempre activo en vez de bloqueado sin motivo aparente.
 *
 * Se engancha en la fase de captura para correr antes que `ngSubmit` y que cualquier `(submit)`.
 */
@Directive({
  selector: 'form[ngForm], form:not([ngNoForm]):not([formGroup])',
  standalone: true,
})
export class EnvioValidadoDirective implements OnDestroy {
  private readonly formulario = inject(NgForm, { optional: true });
  private readonly notify = inject(NotificationService);
  private readonly el = inject<ElementRef<HTMLFormElement>>(ElementRef);
  private readonly alEnviar = (evento: Event) => this.revisar(evento);

  constructor() {
    this.el.nativeElement.addEventListener('submit', this.alEnviar, true);
  }

  ngOnDestroy(): void {
    this.el.nativeElement.removeEventListener('submit', this.alEnviar, true);
  }

  private revisar(evento: Event): void {
    if (!this.formulario || this.formulario.valid) return;
    evento.preventDefault();
    evento.stopImmediatePropagation();
    this.formulario.form.markAllAsTouched();
    const primero = this.el.nativeElement.querySelector<HTMLElement>(
      '.ng-invalid:not(form):not(ng-form)',
    );
    primero?.focus();
    this.notify.warning('Faltan datos. Revise los campos marcados en rojo e inténtelo de nuevo.');
  }
}
