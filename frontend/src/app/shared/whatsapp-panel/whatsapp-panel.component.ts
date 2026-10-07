import { Component, inject } from '@angular/core';
import { WhatsAppSesionService } from '../../core/services/whatsapp-sesion.service';
import { ModalComponent } from '../ui/modal.component';

/** Panel de conexión de WhatsApp Web (QR, estado y acciones). Se monta una vez en el panel admin. */
@Component({
  selector: 'app-whatsapp-panel',
  standalone: true,
  imports: [ModalComponent],
  template: `
    @if (sesion.visible()) {
      <app-modal
        titulo="Conexión WhatsApp Web"
        subtitulo="Vincule el teléfono de la Junta para enviar convocatorias."
        icono="ri-whatsapp-fill"
        tono="whatsapp"
        tamano="sm"
        (cerrar)="sesion.cerrar()"
      >
        <div class="modal__body wa-panel" aria-live="polite">
          @if (sesion.cargando()) {
            <div class="wa-panel__state">
              <span class="spinner" aria-hidden="true"></span>
              <p>Consultando estado de WhatsApp…</p>
            </div>
          } @else if (sesion.estado(); as e) {
            @if (e.isReady) {
              <div class="wa-panel__state wa-panel__state--ok">
                <i class="ri-checkbox-circle-fill" aria-hidden="true"></i>
                <strong>WhatsApp Web conectado</strong>
                <p>Las convocatorias se enviarán automáticamente a los comuneros.</p>
              </div>
            } @else if (e.qrCodeDataUrl) {
              <p class="wa-panel__hint">
                Escanee el código con WhatsApp de la Junta en <strong>Dispositivos vinculados</strong>.
              </p>
              <img class="wa-panel__qr" [src]="e.qrCodeDataUrl" alt="Código QR para vincular WhatsApp" />
            } @else {
              <div class="wa-panel__state">
                <span class="spinner" aria-hidden="true"></span>
                <strong>{{ e.statusMessage || 'Inicializando cliente de WhatsApp…' }}</strong>
                <p>Buscando el código QR automáticamente. Espere unos segundos.</p>
              </div>
            }
            <p class="wa-panel__status">Estado actual: <strong>{{ e.statusMessage }}</strong></p>
          }
        </div>
        <div class="modal__footer modal__footer--wrap">
          <button type="button" class="btn btn--ghost" (click)="sesion.consultar()" [disabled]="sesion.cargando()">
            <i class="ri-refresh-line" aria-hidden="true"></i> Actualizar
          </button>
          <button type="button" class="btn btn--outline" (click)="sesion.reiniciar()" [disabled]="sesion.cargando()">
            <i class="ri-restart-line" aria-hidden="true"></i> Reiniciar conexión
          </button>
          @if (sesion.estado()?.isReady) {
            <button type="button" class="btn btn--danger" (click)="sesion.cerrarSesion()" [disabled]="sesion.cargando()">
              <i class="ri-logout-box-r-line" aria-hidden="true"></i> Cerrar sesión
            </button>
          }
        </div>
      </app-modal>
    }
  `,
  styles: [
    `
      .wa-panel {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1rem;
        text-align: center;
      }
      .wa-panel__state {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
        width: 100%;
        padding: 1.5rem 1rem;
        border-radius: var(--radius-lg);
        background: var(--bg-surface-hover);
        color: var(--text-muted);
      }
      .wa-panel__state p {
        margin: 0;
        font-size: 0.875rem;
      }
      .wa-panel__state strong {
        color: var(--text-main);
      }
      .wa-panel__state--ok {
        background: var(--color-success-light);
      }
      .wa-panel__state--ok i {
        font-size: 2.75rem;
        color: #16a34a;
      }
      .wa-panel__hint {
        margin: 0;
        font-size: 0.9rem;
        color: var(--text-muted);
      }
      .wa-panel__qr {
        width: min(240px, 100%);
        aspect-ratio: 1;
        padding: 0.6rem;
        border-radius: var(--radius-lg);
        background: #fff;
        border: 1px solid var(--border-color);
        box-shadow: var(--shadow-sm);
      }
      .wa-panel__status {
        margin: 0;
        font-size: 0.8rem;
        color: var(--text-muted);
      }
    `
  ]
})
export class WhatsAppPanelComponent {
  readonly sesion = inject(WhatsAppSesionService);
}
