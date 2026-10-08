import { Component, inject, signal } from '@angular/core';
import { WhatsAppSesionService } from '../../core/services/whatsapp-sesion.service';
import { ModalComponent } from '../ui/modal.component';

/**
 * Panel de WhatsApp (se monta una vez en el panel admin): vincular el teléfono de la Junta
 * y elegir el grupo donde se publican las convocatorias de asambleas y mingas.
 */
@Component({
  selector: 'app-whatsapp-panel',
  standalone: true,
  imports: [ModalComponent],
  template: `
    @if (sesion.visible()) {
      <app-modal
        titulo="WhatsApp de la Junta"
        subtitulo="Las convocatorias se publican en un grupo de WhatsApp."
        icono="ri-whatsapp-fill"
        tono="whatsapp"
        tamano="sm"
        (cerrar)="sesion.cerrar()"
      >
        <div class="modal__body wa-panel" aria-live="polite">
          @if (sesion.cargando() && !sesion.estado()) {
            <div class="wa-panel__state">
              <span class="spinner" aria-hidden="true"></span>
              <p>Consultando WhatsApp…</p>
            </div>
          } @else if (sesion.estado(); as e) {
            @switch (e.estado) {
              @case ('CONECTADO') {
                <div class="wa-panel__state wa-panel__state--ok">
                  <i class="ri-checkbox-circle-fill" aria-hidden="true"></i>
                  <strong>WhatsApp conectado</strong>
                </div>

                <div class="form-group wa-panel__grupo">
                  <label for="wa-grupo">Grupo de convocatorias</label>
                  @if (e.grupo) {
                    <p class="wa-panel__actual">Actual: <strong>{{ e.grupo.nombre }}</strong></p>
                  } @else {
                    <p class="wa-panel__aviso">Elija el grupo donde se publicarán las convocatorias.</p>
                  }
                  <div class="wa-panel__fila">
                    <select
                      id="wa-grupo"
                      class="form-control"
                      [value]="seleccion() || e.grupo?.id || ''"
                      (change)="seleccion.set($any($event.target).value)"
                      [disabled]="sesion.cargandoGrupos() || !sesion.grupos().length"
                    >
                      <option value="" disabled>
                        {{ sesion.cargandoGrupos() ? 'Cargando grupos…' : sesion.grupos().length ? 'Seleccione un grupo' : 'La cuenta no pertenece a ningún grupo' }}
                      </option>
                      @for (g of sesion.grupos(); track g.id) {
                        <option [value]="g.id">{{ g.nombre }}{{ g.participantes ? ' (' + g.participantes + ')' : '' }}</option>
                      }
                    </select>
                    <button type="button" class="btn btn--ghost" (click)="sesion.cargarGrupos()"
                      [disabled]="sesion.cargandoGrupos()" title="Volver a cargar los grupos" aria-label="Volver a cargar los grupos">
                      <i class="ri-refresh-line" aria-hidden="true"></i>
                    </button>
                  </div>
                  <button type="button" class="btn btn--whatsapp" (click)="guardar(e.grupo?.id)"
                    [disabled]="sesion.guardandoGrupo() || !seleccion() || seleccion() === e.grupo?.id">
                    <i class="ri-save-line" aria-hidden="true"></i> Usar este grupo
                  </button>
                </div>
              }
              @case ('ESPERANDO_QR') {
                <p class="wa-panel__hint">
                  Escanee el código con el WhatsApp de la Junta en <strong>Dispositivos vinculados</strong>.
                </p>
                @if (e.qr) {
                  <img class="wa-panel__qr" [src]="e.qr" alt="Código QR para vincular WhatsApp" />
                }
              }
              @case ('INICIANDO') {
                <div class="wa-panel__state">
                  <span class="spinner" aria-hidden="true"></span>
                  <strong>{{ e.mensaje }}</strong>
                  <p>Esto puede tardar unos segundos.</p>
                </div>
              }
              @case ('DESCONECTADO') {
                <div class="wa-panel__state">
                  <i class="ri-whatsapp-line" aria-hidden="true"></i>
                  <strong>WhatsApp no está conectado</strong>
                  <p>{{ e.mensaje }}</p>
                </div>
              }
              @default {
                <div class="wa-panel__state wa-panel__state--warn">
                  <i class="ri-error-warning-line" aria-hidden="true"></i>
                  <strong>Servicio de WhatsApp no disponible</strong>
                  <p>{{ e.mensaje }}</p>
                </div>
              }
            }
          }
        </div>
        <div class="modal__footer modal__footer--wrap">
          <button type="button" class="btn btn--ghost" (click)="sesion.consultar()" [disabled]="sesion.cargando()">
            <i class="ri-refresh-line" aria-hidden="true"></i> Actualizar
          </button>
          @if (sesion.estado()?.estado === 'DESCONECTADO') {
            <button type="button" class="btn btn--whatsapp" (click)="sesion.conectar()" [disabled]="sesion.cargando()">
              <i class="ri-link" aria-hidden="true"></i> Conectar WhatsApp
            </button>
          }
          @if (sesion.estado()?.conectado) {
            <button type="button" class="btn btn--danger" (click)="sesion.cerrarSesion()" [disabled]="sesion.cargando()">
              <i class="ri-logout-box-r-line" aria-hidden="true"></i> Desvincular
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
      .wa-panel__state i {
        font-size: 2.75rem;
      }
      .wa-panel__state--ok {
        background: var(--color-success-light);
        padding: 1rem;
      }
      .wa-panel__state--ok i {
        color: #16a34a;
      }
      .wa-panel__state--warn {
        background: var(--color-warning-light);
      }
      .wa-panel__state--warn i {
        color: var(--color-warning-strong);
      }
      .wa-panel__grupo {
        width: 100%;
        margin: 0;
        text-align: left;
      }
      .wa-panel__fila {
        display: flex;
        gap: 0.5rem;
      }
      .wa-panel__actual,
      .wa-panel__aviso {
        margin: 0;
        font-size: 0.85rem;
        color: var(--text-muted);
      }
      .wa-panel__aviso {
        color: var(--color-warning-strong);
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
    `
  ]
})
export class WhatsAppPanelComponent {
  readonly sesion = inject(WhatsAppSesionService);
  /** Grupo elegido en el selector y aún no guardado. */
  readonly seleccion = signal('');

  guardar(actual?: string): void {
    const grupoId = this.seleccion();
    if (!grupoId || grupoId === actual) return;
    this.sesion.guardarGrupo(grupoId);
  }
}
