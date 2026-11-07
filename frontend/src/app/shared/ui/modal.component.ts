import { Component, inject, input, output, signal } from '@angular/core';
import { ModalA11yDirective } from '../../core/directives/modal-a11y.directive';
import { DialogService } from '../../core/services/dialog.service';

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
    <div
      appModalA11y
      (input)="registrarEdicion($event)"
      (change)="registrarEdicion($event)"
      class="modal-backdrop"
      animate.enter="modal-backdrop--enter"
      animate.leave="modal-backdrop--leave"
    >
      <div class="card modal" [class]="'modal--' + tamano()" [attr.aria-labelledby]="tituloId">
        <div class="modal__header">
          <div class="modal__heading">
            @if (icono()) {
              <span class="modal__icon" [class]="'modal__icon--' + tono()" aria-hidden="true"
                ><i [class]="icono()"></i
              ></span>
            }
            <div class="modal__heading-text">
              <h3 [id]="tituloId">{{ titulo() }}</h3>
              @if (subtitulo()) {
                <p class="modal__subtitle">{{ subtitulo() }}</p>
              }
            </div>
          </div>
          <button
            type="button"
            class="btn-close"
            (click)="solicitarCierre()"
            [disabled]="bloqueado()"
            aria-label="Cerrar"
          >
            <i class="ri-close-line" aria-hidden="true"></i>
          </button>
        </div>
        <ng-content />
      </div>
    </div>
  `,
})
export class ModalComponent {
  readonly titulo = input.required<string>();
  readonly subtitulo = input<string>();
  readonly icono = input<string>();
  readonly tono = input<'primary' | 'success' | 'warning' | 'danger' | 'whatsapp'>('primary');
  readonly tamano = input<'sm' | 'md' | 'lg' | 'xl'>('md');
  /** Impide cerrar mientras se guarda. */
  readonly bloqueado = input(false);
  /** Hay cambios que no se detectan por escritura (p. ej. botones de asistencia): fuerza la pregunta al cerrar. */
  readonly sinGuardar = input(false);
  readonly cerrar = output<void>();

  readonly tituloId = `modal-titulo-${++siguienteId}`;

  private readonly dialog = inject(DialogService);
  private readonly escrito = signal(false);

  /** Cualquier campo editado (menos los buscadores) cuenta como trabajo que se perdería al cerrar. */
  protected registrarEdicion(evento: Event): void {
    const campo = evento.target as HTMLElement | null;
    if (!campo?.matches('input, textarea, select')) return;
    if (campo.matches('[type=search], [data-sin-cambios]')) return;
    this.escrito.set(true);
  }

  /**
   * Cierra el modal; si hay datos escritos sin guardar, pregunta antes (la X, Escape y el clic
   * en el fondo pasan por aquí, de modo que un descuido no borra lo ingresado).
   */
  protected async solicitarCierre(): Promise<void> {
    if (this.bloqueado()) return;
    if ((this.escrito() || this.sinGuardar()) && !(await this.dialog.confirmarDescartar())) return;
    this.cerrar.emit();
  }
}
