import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
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
                  <div
                    style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 0.35rem;"
                  >
                    <label for="wa-grupo" style="margin-bottom: 0;">Grupo de convocatorias</label>
                    @if (!sesion.cargandoGrupos() && sesion.grupos().length > 0) {
                      <small class="text-muted" style="font-size: 0.75rem;">
                        {{ gruposFiltrados().length }} de {{ sesion.grupos().length }} grupos
                      </small>
                    }
                  </div>
                  @if (e.grupo) {
                    <p class="wa-panel__actual">
                      Actual: <strong>{{ e.grupo.nombre }}</strong>
                    </p>
                  } @else {
                    <p class="wa-panel__aviso">
                      Elija el grupo donde se publicarán las convocatorias.
                    </p>
                  }

                  @if (!sesion.cargandoGrupos() && sesion.grupos().length > 0) {
                    <div class="search-field" style="margin-bottom: 0.5rem;">
                      <i class="ri-search-line" aria-hidden="true"></i>
                      <input
                        id="wa-grupo-busqueda"
                        type="search"
                        class="input"
                        placeholder="Buscar grupo por nombre…"
                        [value]="busquedaGrupo()"
                        (input)="busquedaGrupo.set($any($event.target).value)"
                        aria-label="Buscar grupo de WhatsApp"
                      />
                    </div>
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
                        {{
                          sesion.cargandoGrupos()
                            ? 'Cargando grupos…'
                            : gruposFiltrados().length
                              ? 'Seleccione un grupo (' + gruposFiltrados().length + ' disponibles)'
                              : busquedaGrupo()
                                ? 'No hay grupos con ese nombre'
                                : 'La cuenta no pertenece a ningún grupo'
                        }}
                      </option>
                      @for (g of gruposFiltrados(); track g.id) {
                        <option [value]="g.id">
                          {{ g.nombre }}{{ g.participantes ? ' (' + g.participantes + ')' : '' }}
                        </option>
                      }
                    </select>
                    <button
                      type="button"
                      class="btn btn--ghost"
                      (click)="sesion.cargarGrupos()"
                      [disabled]="sesion.cargandoGrupos()"
                      title="Volver a cargar los grupos"
                      aria-label="Volver a cargar los grupos"
                    >
                      <i class="ri-refresh-line" aria-hidden="true"></i>
                    </button>
                  </div>
                  @if (
                    busquedaGrupo() && gruposFiltrados().length === 0 && !sesion.cargandoGrupos()
                  ) {
                    <small class="field-error" style="margin-top: 0.25rem;">
                      <i class="ri-information-line" aria-hidden="true"></i> Ningún grupo coincide
                      con "{{ busquedaGrupo() }}".
                    </small>
                  }
                  <button
                    type="button"
                    class="btn btn--whatsapp"
                    (click)="guardar(e.grupo?.id)"
                    [disabled]="
                      sesion.guardandoGrupo() || !seleccion() || seleccion() === e.grupo?.id
                    "
                  >
                    <i class="ri-save-line" aria-hidden="true"></i> Usar este grupo
                  </button>
                </div>
              }
              @case ('ESPERANDO_QR') {
                <p class="wa-panel__hint">
                  Escanee el código con el WhatsApp de la Junta en
                  <strong>Dispositivos vinculados</strong>.
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
          <button
            type="button"
            class="btn btn--ghost"
            (click)="sesion.consultar()"
            [disabled]="sesion.cargando()"
          >
            <i class="ri-refresh-line" aria-hidden="true"></i> Actualizar
          </button>
          @if (sesion.estado()?.estado === 'DESCONECTADO') {
            <button
              type="button"
              class="btn btn--whatsapp"
              (click)="sesion.conectar()"
              [disabled]="sesion.cargando()"
            >
              <i class="ri-link" aria-hidden="true"></i> Conectar WhatsApp
            </button>
          }
          @if (sesion.estado()?.conectado) {
            <button
              type="button"
              class="btn btn--danger"
              (click)="sesion.cerrarSesion()"
              [disabled]="sesion.cargando()"
            >
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
    `,
  ],
})
export class WhatsAppPanelComponent implements OnDestroy {
  readonly sesion = inject(WhatsAppSesionService);
  /** Filtro de búsqueda por nombre de grupo. */
  readonly busquedaGrupo = signal('');
  /** Grupo elegido en el selector y aún no guardado. */
  readonly seleccion = signal('');

  /** Grupos filtrados reactivamente por nombre, manteniendo visible el seleccionado actual. */
  readonly gruposFiltrados = computed(() => {
    const q = this.busquedaGrupo().trim().toLowerCase();
    const todos = this.sesion.grupos();
    if (!q) return todos;

    const coinciden = todos.filter(
      (g) => g.nombre?.toLowerCase().includes(q) || g.id?.toLowerCase().includes(q),
    );
    const actualId = this.seleccion();
    if (actualId && !coinciden.some((g) => g.id === actualId)) {
      const seleccionado = todos.find((g) => g.id === actualId);
      if (seleccionado) return [seleccionado, ...coinciden];
    }
    return coinciden;
  });
  ngOnDestroy(): void {
    this.sesion.cerrar();
  }

  guardar(actual?: string): void {
    const grupoId = this.seleccion();
    if (!grupoId || grupoId === actual) return;
    this.sesion.guardarGrupo(grupoId);
  }
}
