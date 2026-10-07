import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../../../core/services/admin.service';
import { NotificationService } from '../../../../../core/services/notification.service';
import { ModalComponent } from '../../../../../shared/ui/modal.component';

/** Vincula un lote del catastro a un comunero (propietario, heredero o arrendatario). */
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
            <select id="vin-lote" class="input" name="lote_id" [(ngModel)]="form.lote_id" required [disabled]="cargando()">
              <option [ngValue]="null">{{ cargando() ? 'Cargando lotes…' : 'Elija un lote…' }}</option>
              @for (lote of lotes(); track lote.id) {
                <option [ngValue]="lote.id">{{ lote.sector_nombre }} — Lote {{ lote.codigo }}</option>
              }
            </select>
          </div>
          <div class="grid-2">
            <div class="form-group">
              <label for="vin-relacion">Relación</label>
              <select id="vin-relacion" class="input" name="tipo_relacion" [(ngModel)]="form.tipo_relacion">
                <option value="PROPIETARIO">Propietario titular</option>
                <option value="HEREDERO">Heredero</option>
                <option value="ARRENDATARIO">Arrendatario / posicionario</option>
              </select>
            </div>
            <div class="form-group">
              <label for="vin-porcentaje">Porcentaje (%)</label>
              <input id="vin-porcentaje" type="number" class="input" name="porcentaje" [(ngModel)]="form.porcentaje" min="1" max="100" />
            </div>
          </div>
        </div>
        <div class="modal__footer">
          <button type="button" class="btn btn--outline" (click)="cerrar.emit()" [disabled]="guardando()">Cancelar</button>
          <button type="submit" class="btn btn--primary" [disabled]="vincularForm.invalid || guardando()">
            @if (guardando()) {
              <span class="spinner spinner--sm" aria-hidden="true"></span> Vinculando…
            } @else {
              <i class="ri-link" aria-hidden="true"></i> Vincular lote
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
  form = { lote_id: null as number | null, tipo_relacion: 'PROPIETARIO', porcentaje: 100.0 };

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
    if (!this.form.lote_id) {
      this.notify.warning('Seleccione un lote.');
      return;
    }
    this.guardando.set(true);
    this.admin
      .vincularPersonaLote(this.form.lote_id, { persona_id: this.comunero().id, tipo_relacion: this.form.tipo_relacion, porcentaje: this.form.porcentaje })
      .subscribe({
        next: () => {
          this.guardando.set(false);
          this.notify.success('Lote vinculado.');
          this.vinculado.emit();
        },
        error: (err) => {
          this.guardando.set(false);
          this.notify.error(err.error?.message || 'Error al vincular el lote.');
        }
      });
  }
}
