import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../../../core/services/admin.service';
import { NotificationService } from '../../../../../core/services/notification.service';
import { ModalComponent } from '../../../../../shared/ui/modal.component';

/** Titularidad única: un lote pertenece al 100 % a un solo comunero (lo valida también el servidor). */
export const PORCENTAJE_TITULARIDAD = 100;

/**
 * Asigna un lote del catastro a un comunero. Un lote no se comparte: si ya tiene dueño,
 * asignarlo transfiere el 100 % de la propiedad (y sus turnos activos) al nuevo titular.
 */
@Component({
  selector: 'app-vincular-lote',
  standalone: true,
  imports: [FormsModule, ModalComponent],
  template: `
    @let c = comunero();
    <app-modal titulo="Asignar terreno" [subtitulo]="c.apellidos + ' ' + c.nombres + ' · C.I. ' + c.cedula" icono="ri-link" tamano="sm"
      [bloqueado]="guardando()" (cerrar)="cerrar.emit()">
      <form (ngSubmit)="guardar()" #vincularForm="ngForm">
        <div class="modal__body form-stack">
          <div class="form-group">
            <label for="vin-lote">Lote *</label>
            <select id="vin-lote" class="input" name="lote_id" [ngModel]="loteId()" (ngModelChange)="loteId.set($event)" required [disabled]="cargando()">
              <option [ngValue]="null">{{ cargando() ? 'Cargando lotes…' : 'Elija un lote…' }}</option>
              @for (lote of lotes(); track lote.id) {
                <option [ngValue]="lote.id">{{ lote.sector_nombre }} — Lote {{ lote.codigo }}{{ lote.propietarios ? ' (de ' + lote.propietarios + ')' : ' (sin dueño)' }}</option>
              }
            </select>
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
              Un lote pertenece por completo a un solo comunero; no se admite propiedad compartida.
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

  readonly comunero = input.required<any>();
  readonly cerrar = output<void>();
  readonly vinculado = output<void>();

  readonly lotes = signal<any[]>([]);
  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly loteId = signal<number | null>(null);
  tipoRelacion: 'PROPIETARIO' | 'REPRESENTANTE' = 'PROPIETARIO';

  /** Dueño actual del lote elegido, si es otro comunero (el traspaso es total). */
  readonly titularActual = computed<string | null>(() => {
    const lote = this.lotes().find((l) => l.id === this.loteId());
    if (!lote?.propietario_id || Number(lote.propietario_id) === Number(this.comunero().id)) return null;
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
      .vincularPersonaLote(loteId, { persona_id: this.comunero().id, tipo_relacion: this.tipoRelacion, porcentaje: PORCENTAJE_TITULARIDAD })
      .subscribe({
        next: (res: any) => {
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
