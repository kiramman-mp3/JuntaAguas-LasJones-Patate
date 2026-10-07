import { Component, computed, inject } from '@angular/core';
import { DialogService, DialogTipo } from '../../core/services/dialog.service';
import { ModalA11yDirective } from '../../core/directives/modal-a11y.directive';

const ICONOS: Record<DialogTipo, string> = {
  INFO: 'ri-information-line',
  WARNING: 'ri-alert-line',
  DANGER: 'ri-error-warning-line',
  CONFIRM: 'ri-question-line'
};

/**
 * Diálogo global de confirmación, aviso o entrada (reemplazo de alert/confirm/prompt).
 * Se presenta por encima de cualquier modal, entra y sale por el mismo camino.
 */
@Component({
  selector: 'app-dialog-container',
  standalone: true,
  imports: [ModalA11yDirective],
  template: `
    @if (dialogService.estado().visible) {
      @let d = dialogService.estado();
      <div appModalA11y class="modal-backdrop dialog-backdrop" animate.enter="modal-backdrop--enter" animate.leave="modal-backdrop--leave"
        tabindex="-1" aria-labelledby="dialogo-titulo" aria-describedby="dialogo-mensaje"
        (keydown.escape)="dialogService.responder(false)" (mousedown)="$event.target === $event.currentTarget && dialogService.responder(false)">
        <div class="modal card dialog" [class]="'dialog--' + d.tipo.toLowerCase()">
          <div class="dialog__icon" aria-hidden="true"><i [class]="icono()"></i></div>
          <h3 id="dialogo-titulo" class="dialog__title">{{ d.titulo }}</h3>
          <p id="dialogo-mensaje" class="dialog__message">{{ d.mensaje }}</p>
          @if (d.esPrompt) {
            <input
              type="text"
              class="input dialog__input"
              [placeholder]="d.placeholder"
              [value]="d.valor"
              (input)="dialogService.setValor($any($event.target).value)"
              (keydown.enter)="dialogService.responder(true)"
            />
          }
          <div class="dialog__actions">
            @if (d.textoCancelar) {
              <button type="button" class="btn btn--ghost" (click)="dialogService.responder(false)">{{ d.textoCancelar }}</button>
            }
            <button
              type="button"
              class="btn"
              [class.btn--primary]="d.tipo === 'INFO' || d.tipo === 'CONFIRM'"
              [class.btn--danger]="d.tipo === 'DANGER' || d.tipo === 'WARNING'"
              (click)="dialogService.responder(true)"
            >
              {{ d.textoConfirmar }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .dialog-backdrop {
        z-index: 2100;
      }
      .dialog {
        max-width: 420px;
        align-items: center;
        gap: 0.5rem;
        padding: 1.75rem 1.5rem 1.25rem;
        text-align: center;
      }
      .dialog__icon {
        display: grid;
        place-items: center;
        width: 3.25rem;
        height: 3.25rem;
        margin-bottom: 0.35rem;
        border-radius: 50%;
        font-size: 1.6rem;
        background: var(--color-primary-light);
        color: var(--color-primary);
      }
      .dialog--warning .dialog__icon {
        background: var(--color-warning-light);
        color: var(--color-warning-strong);
      }
      .dialog--danger .dialog__icon {
        background: var(--color-danger-light);
        color: var(--color-danger);
      }
      .dialog__title {
        margin: 0;
        font-size: 1.1rem;
        font-weight: 700;
        letter-spacing: -0.015em;
      }
      .dialog__message {
        margin: 0;
        color: var(--text-muted);
        font-size: 0.92rem;
        line-height: 1.55;
        white-space: pre-line;
      }
      .dialog__input {
        margin-top: 0.75rem;
        text-align: left;
      }
      .dialog__actions {
        display: grid;
        grid-auto-flow: column;
        grid-auto-columns: 1fr;
        gap: 0.6rem;
        width: 100%;
        margin-top: 1rem;
      }
    `
  ]
})
export class DialogContainerComponent {
  public dialogService = inject(DialogService);
  readonly icono = computed(() => ICONOS[this.dialogService.estado().tipo]);
}
