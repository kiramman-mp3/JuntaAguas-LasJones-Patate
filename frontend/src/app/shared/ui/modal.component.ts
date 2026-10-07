import { Component, input, output } from '@angular/core';
import { ModalA11yDirective } from '../../core/directives/modal-a11y.directive';

let siguienteId = 0;

/**
 * Contenedor único de modales del panel: fondo atenuado con desenfoque, encabezado con
 * icono, título y cierre, y el contenido proyectado. El consumidor escribe
 * `<div class="modal__body">` y `<div class="modal__footer">` (dentro de un <form> si lo necesita).
 * En móvil se presenta como hoja inferior; entra y sale por el mismo camino.
 */
@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [ModalA11yDirective],
  template: `
    <div appModalA11y class="modal-backdrop" animate.enter="modal-backdrop--enter" animate.leave="modal-backdrop--leave">
      <div class="card modal" [class]="'modal--' + tamano()" [attr.aria-labelledby]="tituloId">
        <div class="modal__header">
          <div class="modal__heading">
            @if (icono()) {
              <span class="modal__icon" [class]="'modal__icon--' + tono()" aria-hidden="true"><i [class]="icono()"></i></span>
            }
            <div class="modal__heading-text">
              <h3 [id]="tituloId">{{ titulo() }}</h3>
              @if (subtitulo()) {
                <p class="modal__subtitle">{{ subtitulo() }}</p>
              }
            </div>
          </div>
          <button type="button" class="btn-close" (click)="cerrar.emit()" [disabled]="bloqueado()" aria-label="Cerrar">
            <i class="ri-close-line" aria-hidden="true"></i>
          </button>
        </div>
        <ng-content />
      </div>
    </div>
  `
})
export class ModalComponent {
  readonly titulo = input.required<string>();
  readonly subtitulo = input<string>();
  readonly icono = input<string>();
  readonly tono = input<'primary' | 'success' | 'warning' | 'danger' | 'whatsapp'>('primary');
  readonly tamano = input<'sm' | 'md' | 'lg' | 'xl'>('md');
  /** Impide cerrar mientras se guarda. */
  readonly bloqueado = input(false);
  readonly cerrar = output<void>();

  readonly tituloId = `modal-titulo-${++siguienteId}`;
}
