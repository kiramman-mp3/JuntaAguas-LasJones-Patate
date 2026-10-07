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
      <div appModalA11y class="modal-backdrop" aria-labelledby="titulo-password-temporal">
        <div class="card modal" style="max-width: 460px; width: 95%;">
          <div class="modal__header">
            <h3 id="titulo-password-temporal"><i aria-hidden="true" class="ri-key-2-line"></i> Contraseña temporal</h3>
          </div>
          <div class="modal-body">
            <p>Entregue estos datos a <strong>{{ credencial.nombre }}</strong>. Al ingresar por primera vez deberá elegir una contraseña nueva.</p>
            <dl class="credencial">
              <dt>Cédula</dt>
              <dd>{{ credencial.cedula }}</dd>
              <dt>Contraseña temporal</dt>
              <dd class="credencial__password" data-testid="password-temporal">{{ credencial.password }}</dd>
            </dl>
            <p class="alert alert--warning" role="note">
              <i aria-hidden="true" class="ri-error-warning-line"></i>
              Esta contraseña solo se muestra ahora. Si se pierde, deberá restablecerla.
            </p>
            <div class="modal__footer">
              <button type="button" class="btn btn--outline" (click)="copiar()">
                <i aria-hidden="true" [class]="copiada ? 'ri-check-line' : 'ri-file-copy-line'"></i>
                {{ copiada ? 'Copiada' : 'Copiar' }}
              </button>
              <button type="button" class="btn btn--primary" (click)="cerrar()">Ya la anoté</button>
            </div>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .credencial { display: grid; grid-template-columns: auto 1fr; gap: 0.5rem 1rem; margin: 1rem 0; }
    .credencial dt { color: var(--text-muted); }
    .credencial dd { margin: 0; font-weight: 600; }
    .credencial__password { font-family: ui-monospace, monospace; font-size: 1.25rem; letter-spacing: 0.08em; user-select: all; }
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
