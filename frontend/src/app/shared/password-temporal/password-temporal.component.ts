import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ModalA11yDirective } from '../../core/directives/modal-a11y.directive';

export interface CredencialTemporal {
  nombre: string;
  cedula: string;
  password: string;
}

/**
 * Muestra una sola vez la contraseña temporal generada por el servidor.
 * No tiene botón de cierre rápido (Escape o clic en el fondo) para que no se pierda por accidente:
 * el servidor no la guarda en claro y no se puede volver a consultar.
 */
@Component({
  selector: 'app-password-temporal',
  standalone: true,
  imports: [ModalA11yDirective],
  template: `
    @if (credencial) {
      <div appModalA11y class="modal-backdrop credencial-backdrop" animate.enter="modal-backdrop--enter" animate.leave="modal-backdrop--leave"
        aria-labelledby="titulo-password-temporal">
        <div class="card modal modal--sm">
          <div class="modal__header">
            <div class="modal__heading">
              <span class="modal__icon modal__icon--warning" aria-hidden="true"><i class="ri-key-2-line"></i></span>
              <div class="modal__heading-text">
                <h3 id="titulo-password-temporal">Contraseña temporal</h3>
                <p class="modal__subtitle">Se muestra una sola vez.</p>
              </div>
            </div>
          </div>
          <div class="modal__body form-stack">
            <p>Entregue estos datos a <strong>{{ credencial.nombre }}</strong>. Al ingresar por primera vez deberá elegir una contraseña nueva.</p>
            <dl class="credencial">
              <div>
                <dt>Cédula</dt>
                <dd class="money">{{ credencial.cedula }}</dd>
              </div>
              <div>
                <dt>Contraseña temporal</dt>
                <dd class="credencial__password" data-testid="password-temporal">{{ credencial.password }}</dd>
              </div>
            </dl>
            <p class="alert alert--warning" role="note">
              <i aria-hidden="true" class="ri-error-warning-line"></i>
              Si se pierde, deberá restablecerla desde la ficha del comunero.
            </p>
          </div>
          <div class="modal__footer">
            <button type="button" class="btn btn--outline" (click)="copiar()">
              <i aria-hidden="true" [class]="copiada ? 'ri-check-line' : 'ri-file-copy-line'"></i>
              {{ copiada ? 'Copiada' : 'Copiar' }}
            </button>
            <button type="button" class="btn btn--primary" (click)="cerrar()">Ya la anoté</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .credencial-backdrop { z-index: 1100; }
    .credencial { display: grid; gap: 0.5rem; margin: 0; padding: 1rem; border-radius: var(--radius-lg); background: var(--bg-surface-hover); }
    .credencial > div { display: flex; justify-content: space-between; align-items: baseline; gap: 1rem; flex-wrap: wrap; }
    .credencial dt { color: var(--text-muted); font-size: 0.85rem; }
    .credencial dd { margin: 0; font-weight: 600; }
    .credencial__password { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 1.3rem; letter-spacing: 0.08em; user-select: all; }
  `]
})
export class PasswordTemporalComponent {
  @Input() credencial: CredencialTemporal | null = null;
  @Output() cerrado = new EventEmitter<void>();
  copiada = false;

  async copiar() {
    if (!this.credencial) return;
    try {
      await navigator.clipboard.writeText(this.credencial.password);
      this.copiada = true;
    } catch {
      /* Sin acceso al portapapeles: la contraseña sigue visible y seleccionable. */
    }
  }

  cerrar() {
    this.copiada = false;
    this.cerrado.emit();
  }
}
