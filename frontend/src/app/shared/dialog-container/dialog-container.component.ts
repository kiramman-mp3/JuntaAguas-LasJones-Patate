import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DialogService } from '../../core/services/dialog.service';
import { ModalA11yDirective } from '../../core/directives/modal-a11y.directive';

@Component({
  selector: 'app-dialog-container',
  standalone: true,
  imports: [CommonModule, ModalA11yDirective],
  template: `
    <div appModalA11y class="modal-backdrop" *ngIf="dialogService.estado().visible">
      <div class="modal card dialog-modal"
        [ngClass]="'dialog-modal--' + dialogService.estado().tipo.toLowerCase()">
        <div class="dialog-modal__header">
          <div class="dialog-modal__icon">
            <i aria-hidden="true"
              [ngClass]="{
                'ri-information-line': dialogService.estado().tipo === 'INFO',
                'ri-alert-line': dialogService.estado().tipo === 'WARNING',
                'ri-error-warning-line': dialogService.estado().tipo === 'DANGER',
                'ri-question-line': dialogService.estado().tipo === 'CONFIRM'
              }"></i>
          </div>
          <h3 class="dialog-modal__title">{{ dialogService.estado().titulo }}</h3>
          <button type="button" class="btn-close" (click)="dialogService.responder(false)" aria-label="Cerrar">
            <i class="ri-close-line" aria-hidden="true"></i>
          </button>
        </div>

        <div class="dialog-modal__body">
          <p class="dialog-modal__message">{{ dialogService.estado().mensaje }}</p>
          <input *ngIf="dialogService.estado().esPrompt"
            type="text"
            class="input dialog-modal__input"
            [placeholder]="dialogService.estado().placeholder"
            [value]="dialogService.estado().valor"
            (input)="dialogService.setValor($any($event.target).value)"
            (keydown.enter)="dialogService.responder(true)" />
        </div>

        <div class="dialog-modal__footer">
          <button *ngIf="dialogService.estado().textoCancelar" type="button" class="btn btn--outline"
            (click)="dialogService.responder(false)">
            {{ dialogService.estado().textoCancelar }}
          </button>
          <button type="button" class="btn"
            [class.btn--primary]="dialogService.estado().tipo === 'INFO' || dialogService.estado().tipo === 'CONFIRM'"
            [class.btn--danger]="dialogService.estado().tipo === 'DANGER' || dialogService.estado().tipo === 'WARNING'"
            (click)="dialogService.responder(true)">
            {{ dialogService.estado().textoConfirmar }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dialog-modal {
      max-width: 480px;
      padding: 0;
      overflow: hidden;
    }
    .dialog-modal__header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 1.25rem 1.5rem 0.75rem;
    }
    .dialog-modal__icon {
      width: 2.75rem;
      height: 2.75rem;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.5rem;
      flex-shrink: 0;
      background: var(--color-primary-light, #e0f2fe);
      color: var(--color-primary, #0284c7);
    }
    .dialog-modal--warning .dialog-modal__icon { background: #fef3c7; color: #b45309; }
    .dialog-modal--danger .dialog-modal__icon { background: #fee2e2; color: #b91c1c; }
    .dialog-modal--confirm .dialog-modal__icon { background: var(--color-primary-light, #e0f2fe); color: var(--color-primary, #0284c7); }
    .dialog-modal__title { flex: 1; margin: 0; font-size: 1.1rem; }
    .dialog-modal__body { padding: 0 1.5rem 1rem; }
    .dialog-modal__message { margin: 0; color: var(--text-muted, #64748b); line-height: 1.5; }
    .dialog-modal__input { margin-top: 1rem; }
    .dialog-modal__footer {
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
      padding: 1rem 1.5rem;
      background: var(--bg-surface-hover, #f1f5f9);
      border-top: 1px solid var(--border-color, #e2e8f0);
    }
  `]
})
export class DialogContainerComponent {
  public dialogService = inject(DialogService);
}
