import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../../../core/services/admin.service';
import { NotificationService } from '../../../../../core/services/notification.service';
import { ModalComponent } from '../../../../../shared/ui/modal.component';

/** Titularidad única: un lote pertenece al 100 % a un solo usuario (lo valida también el servidor). */
export const PORCENTAJE_TITULARIDAD = 100;

/**
 * Asigna un lote del catastro a un usuario. Un lote no se comparte: si ya tiene dueño,
 * asignarlo transfiere el 100 % de la propiedad (y sus turnos activos) al nuevo titular.
 */
@Component({
  selector: 'app-vincular-lote',
  standalone: true,
  imports: [FormsModule, ModalComponent],
  template: `
    @let c = usuario();
    <app-modal titulo="Asignar terreno" [subtitulo]="c.apellidos + ' ' + c.nombres + ' · C.I. ' + c.cedula" icono="ri-link" tamano="sm"
      [bloqueado]="guardando()" (cerrar)="cerrar.emit()">
      <form (ngSubmit)="guardar()" #vincularForm="ngForm">
        <div class="modal__body form-stack">
          <div class="form-group">
            <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 0.35rem;">
              <label for="vin-lote" style="margin-bottom: 0;">Lote *</label>
              @if (!cargando() && lotes().length > 0) {
                <small class="text-muted" style="font-size: 0.75rem;">
                  {{ lotesFiltrados().length }} de {{ lotes().length }} disponibles
                </small>
              }
            </div>
            <div class="search-field" style="margin-bottom: 0.5rem;">
              <i class="ri-search-line" aria-hidden="true"></i>
              <input
                id="vin-lote-busqueda"
                type="search"
                class="input"
                placeholder="Buscar por código, sector o usuario…"
                [ngModel]="busqueda()"
                (ngModelChange)="busqueda.set($event)"
                [disabled]="cargando()"
                aria-label="Buscar lote"
              />
            </div>
            <select id="vin-lote" class="input" name="lote_id" [ngModel]="loteId()" (ngModelChange)="loteId.set($event)" required [disabled]="cargando()">
              <option [ngValue]="null">
                {{ cargando() ? 'Cargando lotes…' : lotesFiltrados().length ? 'Elija un lote (' + lotesFiltrados().length + ' disponibles)…' : 'No hay lotes con ese criterio' }}
              </option>
              @for (lote of lotesFiltrados(); track lote.id) {
                <option [ngValue]="lote.id">{{ lote.sector_nombre }} — Lote {{ lote.codigo }}{{ lote.propietarios ? ' (de ' + lote.propietarios + ')' : ' (sin dueño)' }}</option>
              }
            </select>
            @if (busqueda() && lotesFiltrados().length === 0 && !cargando()) {
              <small class="field-error" style="margin-top: 0.25rem;">
                <i class="ri-information-line" aria-hidden="true"></i> No se encontraron lotes que coincidan con "{{ busqueda() }}".
              </small>
            }
          </div>

          <div class="form-group">
            <label for="vin-relacion">Relación con el lote</label>
            <select id="vin-relacion" class="input" name="tipo_relacion" [(ngModel)]="tipoRelacion">
              <option value="PROPIETARIO">Propietario titular</option>
              <option value="REPRESENTANTE">Representante</option>
            </select>
          </div>

          <div class="ownership" role="note">
            <span class="ownership__value">100 %</span>
            <span class="ownership__text">
              <strong>Titularidad única</strong>
              Un lote pertenece por completo a un solo usuario; no se admite propiedad compartida.
            </span>
          </div>

          @if (titularActual(); as titular) {
            <div class="alert alert--warning" role="alert" animate.enter="reveal-enter">
              <i class="ri-swap-line" aria-hidden="true"></i>
              <span>Este lote pertenece a <strong>{{ titular }}</strong>. Al asignarlo se le transfiere el 100 % a {{ c.nombres }} {{ c.apellidos }}, junto con sus turnos de riego activos.</span>
            </div>
          }
        </div>
        <div class="modal__footer">
          <button type="button" class="btn btn--outline" (click)="cerrar.emit()" [disabled]="guardando()">Cancelar</button>
          <button type="submit" class="btn btn--primary" [disabled]="vincularForm.invalid || guardando()">
            @if (guardando()) {
              <span class="spinner spinner--sm" aria-hidden="true"></span> Guardando…
            } @else if (titularActual()) {
              <i class="ri-swap-line" aria-hidden="true"></i> Transferir lote
            } @else {
              <i class="ri-link" aria-hidden="true"></i> Asignar lote
            }
          </button>
        </div>
      </form>
    </app-modal>
  `
})
export class VincularLoteComponent implements OnInit {
  private admin = inject(AdminService);
  private notify = inject(NotificationService);

  readonly usuario = input.required<any>();
  readonly cerrar = output<void>();
  readonly vinculado = output<void>();

  readonly lotes = signal<any[]>([]);
  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly loteId = signal<number | null>(null);
  readonly busqueda = signal('');
  tipoRelacion: 'PROPIETARIO' | 'REPRESENTANTE' = 'PROPIETARIO';

  /** Lotes filtrados por código, sector, ID o propietario, conservando el seleccionado si existe. */
  readonly lotesFiltrados = computed(() => {
    const q = this.busqueda().trim().toLowerCase();
    const todos = this.lotes();
    if (!q) return todos;

    const coinciden = todos.filter((l) => {
      const codigo = String(l.codigo || '').toLowerCase();
      const sector = String(l.sector_nombre || '').toLowerCase();
      const prop = String(l.propietarios || l.propietario_nombre || '').toLowerCase();
      const id = String(l.id || '');
      return codigo.includes(q) || sector.includes(q) || prop.includes(q) || id === q;
    });

    const actualId = this.loteId();
    if (actualId && !coinciden.some((l) => l.id === actualId)) {
      const loteSeleccionado = todos.find((l) => l.id === actualId);
      if (loteSeleccionado) {
        return [loteSeleccionado, ...coinciden];
      }
    }
    return coinciden;
  });

  /** Dueño actual del lote elegido, si es otro usuario (el traspaso es total). */
  readonly titularActual = computed<string | null>(() => {
    const lote = this.lotes().find((l) => l.id === this.loteId());
    if (!lote?.propietario_id || Number(lote.propietario_id) === Number(this.usuario().id)) return null;
    return lote.propietario_nombre || lote.propietarios;
  });

  ngOnInit(): void {
    this.admin.getLotes().subscribe({
      next: (res) => {
        this.lotes.set(res?.data ?? []);
        this.cargando.set(false);
      },
      error: () => {
        this.cargando.set(false);
        this.notify.error('Error al cargar lotes para vinculación.');
      }
    });
  }

  guardar(): void {
    const loteId = this.loteId();
    if (!loteId) {
      this.notify.warning('Seleccione un lote.');
      return;
    }
    this.guardando.set(true);
    this.admin
      .vincularPersonaLote(loteId, { persona_id: this.usuario().id, tipo_relacion: this.tipoRelacion, porcentaje: PORCENTAJE_TITULARIDAD })
      .subscribe({
        next: (res) => {
          this.guardando.set(false);
          this.notify.success(res?.message || 'Lote asignado.');
          this.vinculado.emit();
        },
        error: (err) => {
          this.guardando.set(false);
          this.notify.error(err.error?.message || 'Error al asignar el lote.');
        }
      });
  }
}
