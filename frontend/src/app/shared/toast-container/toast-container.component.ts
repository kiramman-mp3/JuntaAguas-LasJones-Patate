import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationService } from '../../core/services/notification.service';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast-stack" aria-live="polite" aria-atomic="false">
      @for (t of notificationService.toasts(); track t) {
        <div class="toast" [ngClass]="'toast--' + t.tipo" role="status">
          <i
            class="toast__icon"
            aria-hidden="true"
            [ngClass]="{
              'ri-checkbox-circle-fill': t.tipo === 'success',
              'ri-error-warning-fill': t.tipo === 'error',
              'ri-information-fill': t.tipo === 'info',
              'ri-alert-fill': t.tipo === 'warning',
            }"
          ></i>
          <span class="toast__message">{{ t.mensaje }}</span>
          <button
            type="button"
            class="toast__close"
            (click)="notificationService.cerrar(t.id)"
            aria-label="Cerrar notificación"
          >
            <i class="ri-close-line" aria-hidden="true"></i>
          </button>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .toast-stack {
        position: fixed;
        top: 84px;
        right: 1rem;
        z-index: 3000;
        display: flex;
        flex-direction: column;
        gap: 0.6rem;
        max-width: 380px;
        width: calc(100% - 2rem);
        pointer-events: none;
      }
      .toast {
        pointer-events: auto;
        display: flex;
        align-items: center;
        gap: 0.6rem;
        padding: 0.85rem 1rem;
        border-radius: var(--radius-md, 8px);
        background: var(--bg-surface, #fff);
        border-left: 4px solid var(--color-primary, #0284c7);
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.25);
        color: var(--text-main, #0f172a);
        font-size: 0.9rem;
        animation: toastIn 0.25s ease;
      }
      .toast__icon {
        font-size: 1.35rem;
        flex-shrink: 0;
      }
      .toast__message {
        flex: 1;
        line-height: 1.4;
      }
      .toast__close {
        background: none;
        border: none;
        cursor: pointer;
        color: var(--text-muted, #64748b);
        font-size: 1.1rem;
        display: flex;
        align-items: center;
        flex-shrink: 0;
      }
      .toast--success {
        border-left-color: var(--color-success, #10b981);
      }
      .toast--success .toast__icon {
        color: var(--color-success, #10b981);
      }
      .toast--error {
        border-left-color: var(--color-danger, #ef4444);
      }
      .toast--error .toast__icon {
        color: var(--color-danger, #ef4444);
      }
      .toast--info {
        border-left-color: var(--color-primary, #0284c7);
      }
      .toast--info .toast__icon {
        color: var(--color-primary, #0284c7);
      }
      .toast--warning {
        border-left-color: var(--color-accent-amber, #f59e0b);
      }
      .toast--warning .toast__icon {
        color: var(--color-accent-amber, #f59e0b);
      }
      @keyframes toastIn {
        from {
          opacity: 0;
          transform: translateX(20px);
        }
        to {
          opacity: 1;
          transform: translateX(0);
        }
      }
    `,
  ],
})
export class ToastContainerComponent {
  public notificationService = inject(NotificationService);
}
