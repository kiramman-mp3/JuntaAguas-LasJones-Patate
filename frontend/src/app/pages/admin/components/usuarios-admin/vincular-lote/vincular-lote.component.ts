import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../../../core/services/admin.service';
import { NotificationService } from '../../../../../core/services/notification.service';
import { ModalComponent } from '../../../../../shared/ui/modal.component';
import { LoteItem, PersonaListado } from '../../../../../core/models/api-payloads';
import { AYUDAS_FORMULARIO } from '../../../../../core/directives/formularios';

/** Titularidad única: un lote pertenece al 100 % a un solo usuario (lo valida también el servidor). */
export const PORCENTAJE_TITULARIDAD = 100;

/**
 * Asigna un lote del catastro a un usuario. Un lote no se comparte: si ya tiene dueño,
 * asignarlo transfiere el 100 % de la propiedad (y sus turnos activos) al nuevo titular.
 */
@Component({
  selector: 'app-vincular-lote',
  standalone: true,
  imports: [FormsModule, ...AYUDAS_FORMULARIO, ModalComponent],
  template: `
    @let c = usuario();
    <app-modal
      titulo="Asignar terreno"
      [subtitulo]="c.apellidos + ' ' + c.nombres + ' · C.I. ' + c.cedula"
      icono="ri-link"
      tamano="md"
      [bloqueado]="guardando()"
      (cerrar)="cerrar.emit()"
    >
      <form (ngSubmit)="guardar()" #vincularForm="ngForm">
        <div class="modal__body form-stack">
          <p class="form-legend">
            <span class="req" aria-hidden="true">*</span> Campos obligatorios
          </p>
          <fieldset class="field-set">
            <legend class="field-set__legend">
              Lote <span class="req" aria-hidden="true">*</span>
            </legend>
            <div class="lote-filtros">
              <div class="search-field">
                <i class="ri-search-line" aria-hidden="true"></i>
                <input
                  id="vin-lote-busqueda"
                  type="search"
                  class="input"
                  placeholder="Código, sector o dueño…"
                  [ngModel]="busqueda()"
                  [ngModelOptions]="{ standalone: true }"
                  (ngModelChange)="busqueda.set($event)"
                  [disabled]="cargando()"
                  aria-label="Buscar lote"
                />
              </div>
              <select
                class="input"
                [ngModel]="sectorId()"
                [ngModelOptions]="{ standalone: true }"
                (ngModelChange)="sectorId.set($event)"
                [disabled]="cargando()"
                aria-label="Sector del lote"
              >
                <option [ngValue]="null">Todos los sectores</option>
                @for (s of sectores(); track s.id) {
                  <option [ngValue]="s.id">{{ s.nombre }}</option>
                }
              </select>
            </div>
            <div class="lote-list" role="radiogroup" aria-label="Lotes">
              @if (cargando()) {
                <p class="lote-list__vacio">Cargando lotes…</p>
              } @else {
                @for (lote of lotesFiltrados(); track lote.id) {
                  <label class="lote-opt" [class.lote-opt--selected]="loteId() === lote.id">
                    <input
                      type="radio"
                      name="lote_id"
                      [value]="lote.id"
                      [checked]="loteId() === lote.id"
                      (change)="loteId.set(lote.id)"
                    />
                    <span class="lote-opt__main">
                      <strong>Lote {{ lote.codigo }}</strong>
                      <span class="lote-opt__sector">{{ lote.sector_nombre }}</span>
                    </span>
                    <span
                      class="lote-opt__owner"
                      [class.lote-opt__owner--libre]="!lote.propietarios"
                    >
                      {{ lote.propietarios ? 'de ' + lote.propietarios : 'Sin dueño' }}
                    </span>
                  </label>
                } @empty {
                  <p class="lote-list__vacio">Ningún lote coincide con la búsqueda o el sector.</p>
                }
              }
            </div>
            @if (!cargando()) {
              <small class="field__hint">
                {{ lotesFiltrados().length }} de {{ lotes().length }} lotes
              </small>
            }
          </fieldset>

          <div class="form-group">
            <label for="vin-relacion"
              >Relación con el lote <span class="req" aria-hidden="true">*</span></label
            >
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
              <span
                >Este lote pertenece a <strong>{{ titular }}</strong
                >. Al asignarlo se le transfiere el 100 % a {{ c.nombres }} {{ c.apellidos }}, junto
                con sus turnos de riego activos.</span
              >
            </div>
          }
        </div>
        <div class="modal__footer">
          <button type="button" class="btn btn--outline" data-cancelar [disabled]="guardando()">
            Cancelar
          </button>
          <button type="submit" class="btn btn--primary" [disabled]="guardando() || !loteId()">
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
  `,
})
export class VincularLoteComponent implements OnInit {
  private admin = inject(AdminService);
  private notify = inject(NotificationService);

  readonly usuario = input.required<PersonaListado>();
  readonly cerrar = output<void>();
  readonly vinculado = output<void>();

  readonly lotes = signal<LoteItem[]>([]);
  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly loteId = signal<number | null>(null);
  readonly busqueda = signal('');
  readonly sectorId = signal<number | null>(null);
  tipoRelacion: 'PROPIETARIO' | 'REPRESENTANTE' = 'PROPIETARIO';

  /** Sectores que tienen lotes, para el filtro. */
  readonly sectores = computed(() => {
    const porId = new Map<number, string>();
    for (const l of this.lotes()) porId.set(l.sector_id, l.sector_nombre);
    return [...porId]
      .map(([id, nombre]) => ({ id, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  });

  /** Lotes filtrados por sector y por código, sector, ID o propietario, conservando el seleccionado si existe. */
  readonly lotesFiltrados = computed(() => {
    const q = this.busqueda().trim().toLowerCase();
    const sectorElegido = this.sectorId();
    const todos = this.lotes();
    if (!q && sectorElegido === null) return todos;

    const coinciden = todos.filter((l) => {
      if (sectorElegido !== null && l.sector_id !== sectorElegido) return false;
      if (!q) return true;
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
    if (!lote?.propietario_id || Number(lote.propietario_id) === Number(this.usuario().id))
      return null;
    return lote.propietario_nombre || lote.propietarios || null;
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
      },
    });
  }

  guardar(): void {
    if (this.guardando()) return;
    const loteId = this.loteId();
    if (!loteId) {
      this.notify.warning('Seleccione un lote.');
      return;
    }
    this.guardando.set(true);
    this.admin
      .vincularPersonaLote(loteId, {
        persona_id: this.usuario().id,
        tipo_relacion: this.tipoRelacion,
        porcentaje: PORCENTAJE_TITULARIDAD,
      })
      .subscribe({
        next: (res) => {
          this.guardando.set(false);
          this.notify.success(res?.message || 'Lote asignado.');
          this.vinculado.emit();
        },
        error: (err) => {
          this.guardando.set(false);
          this.notify.error(err.error?.message || 'Error al asignar el lote.');
        },
      });
  }
}
