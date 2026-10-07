import { Component, inject } from '@angular/core';
import { NotificationService, ToastTipo } from '../../core/services/notification.service';

const ICONOS: Record<ToastTipo, string> = {
  success: 'ri-checkbox-circle-fill',
  error: 'ri-error-warning-fill',
  info: 'ri-information-fill',
  warning: 'ri-alert-fill'
};

/**
 * Pila de notificaciones: material translúcido que entra desde arriba y sale por el
 * mismo camino. Pasar el cursor o enfocar un aviso detiene su temporizador.
 */
@Component({
  selector: 'app-toast-container',
  standalone: true,
  template: `
    <div class="toast-stack" aria-live="polite" aria-atomic="false">
      @for (t of notificationService.toasts(); track t.id) {
        <div
          class="toast"
          [class]="'toast--' + t.tipo"
          [attr.role]="t.tipo === 'error' ? 'alert' : 'status'"
          animate.enter="toast--enter"
          animate.leave="toast--leave"
          (mouseenter)="notificationService.pausar(t.id)"
          (mouseleave)="notificationService.reanudar(t.id)"
          (focusin)="notificationService.pausar(t.id)"
          (focusout)="notificationService.reanudar(t.id)"
        >
          <span class="toast__icon" aria-hidden="true"><i [class]="iconos[t.tipo]"></i></span>
          <span class="toast__message">{{ t.mensaje }}</span>
          <button type="button" class="toast__close" (click)="notificationService.cerrar(t.id)" aria-label="Cerrar notificación">
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
        top: calc(70px + 0.75rem);
        right: 1rem;
        z-index: 3000;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 0.5rem;
        width: min(380px, calc(100% - 2rem));
        pointer-events: none;
      }
      @media (max-width: 600px) {
        .toast-stack {
          right: 50%;
          transform: translateX(50%);
          align-items: stretch;
        }
      }
      .toast {
        --tono: var(--color-primary);
        --tono-suave: var(--color-primary-light);
        pointer-events: auto;
        display: flex;
        align-items: flex-start;
        gap: 0.7rem;
        width: 100%;
        padding: 0.8rem 0.6rem 0.8rem 0.8rem;
        border-radius: 16px;
        background: var(--glass-bg);
        backdrop-filter: blur(24px) saturate(180%);
        -webkit-backdrop-filter: blur(24px) saturate(180%);
        border: 1px solid var(--glass-border);
        box-shadow: var(--shadow-lg);
        color: var(--text-main);
        font-size: 0.88rem;
        font-weight: 500;
        line-height: 1.45;
      }
      .toast--success { --tono: var(--color-success-strong); --tono-suave: var(--color-success-light); }
      .toast--error { --tono: var(--color-danger); --tono-suave: var(--color-danger-light); }
      .toast--warning { --tono: var(--color-warning-strong); --tono-suave: var(--color-warning-light); }
      .toast__icon {
        display: grid;
        place-items: center;
        width: 1.9rem;
        height: 1.9rem;
        flex-shrink: 0;
        border-radius: 50%;
        background: var(--tono-suave);
        color: var(--tono);
        font-size: 1.1rem;
      }
      .toast__message {
        flex: 1;
        min-width: 0;
        padding-top: 0.2rem;
        overflow-wrap: anywhere;
      }
      .toast__close {
        display: grid;
        place-items: center;
        width: 1.75rem;
        height: 1.75rem;
        flex-shrink: 0;
        border: none;
        border-radius: 50%;
        background: transparent;
        color: var(--text-muted);
        font-size: 1.05rem;
        cursor: pointer;
        transition: background-color 0.15s ease, color 0.15s ease;
      }
      .toast__close:hover {
        background: var(--bg-surface-hover);
        color: var(--text-main);
      }
      .toast--enter {
        animation: toast-in 0.4s var(--ease-out) both;
      }
      .toast--leave {
        animation: toast-in 0.22s ease-in reverse both;
      }
      @keyframes toast-in {
        from {
          opacity: 0;
          transform: translateY(-12px) scale(0.96);
          filter: blur(4px);
        }
        to {
          opacity: 1;
          transform: none;
          filter: none;
        }
      }
      @media (prefers-reduced-transparency: reduce) {
        .toast {
          background: var(--bg-surface);
          backdrop-filter: none;
          -webkit-backdrop-filter: none;
        }
      }
    `
  ]
})
export class ToastContainerComponent {
  public notificationService = inject(NotificationService);
  readonly iconos = ICONOS;
}
