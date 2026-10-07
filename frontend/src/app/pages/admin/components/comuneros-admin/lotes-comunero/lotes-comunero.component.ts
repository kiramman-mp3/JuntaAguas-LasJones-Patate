import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { AdminService } from '../../../../../core/services/admin.service';
import { ModalComponent } from '../../../../../shared/ui/modal.component';
import { SkeletonComponent } from '../../../../../shared/ui/skeleton.component';
import { EmptyStateComponent } from '../../../../../shared/ui/empty-state.component';

/** Lotes vinculados a un comunero, con acceso a la ficha de cada uno. */
@Component({
  selector: 'app-lotes-comunero',
  standalone: true,
  imports: [ModalComponent, SkeletonComponent, EmptyStateComponent],
  template: `
    @let c = comunero();
    <app-modal [titulo]="'Lotes de ' + c.apellidos + ' ' + c.nombres" [subtitulo]="'C.I. ' + c.cedula" icono="ri-map-pin-line" tamano="lg" (cerrar)="cerrar.emit()">
      <div class="modal__body">
        @if (cargando()) {
          <app-skeleton [filas]="3" mensaje="Cargando lotes del comunero…" />
        } @else if (error()) {
          <app-empty-state tono="error" icono="ri-wifi-off-line" titulo="No se pudieron cargar los lotes">
            <button type="button" class="btn btn--outline btn--sm" (click)="cargar()">Reintentar</button>
          </app-empty-state>
        } @else if (!lotes().length) {
          <app-empty-state icono="ri-map-pin-line" titulo="Sin lotes vinculados" mensaje="Este comunero todavía no tiene terrenos asignados." />
        } @else {
          <div class="table-container">
            <table class="table-custom table-custom--stack">
              <thead>
                <tr><th>Código</th><th>Sector</th><th>Superficie</th><th>Coordenadas</th><th><span class="sr-only">Acciones</span></th></tr>
              </thead>
              <tbody>
                @for (lote of lotes(); track lote.id) {
                  <tr>
                    <td data-label="Código"><strong>{{ lote.codigo }}</strong></td>
                    <td data-label="Sector">{{ lote.sector_nombre }}</td>
                    <td data-label="Superficie">{{ lote.superficie_m2 ? lote.superficie_m2 + ' m²' : 'N/D' }}</td>
                    <td data-label="Coordenadas">
                      @if (lote.latitud_aproximada) {
                        <span class="money text-muted small">{{ lote.latitud_aproximada }}, {{ lote.longitud_aproximada }}</span>
                      } @else {
                        <span class="text-muted">Sin coordenadas</span>
                      }
                    </td>
                    <td class="cell-actions">
                      <button type="button" class="btn btn--ghost btn--sm" (click)="verLote.emit(lote)"><i class="ri-eye-line" aria-hidden="true"></i> Ver ficha</button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>
      <div class="modal__footer">
        <button type="button" class="btn btn--outline" (click)="cerrar.emit()">Cerrar</button>
        <button type="button" class="btn btn--primary" (click)="asignarOtro.emit()"><i class="ri-map-pin-add-line" aria-hidden="true"></i> Asignar otro terreno</button>
      </div>
    </app-modal>
  `
})
export class LotesComuneroComponent implements OnInit {
  private admin = inject(AdminService);

  readonly comunero = input.required<any>();
  readonly cerrar = output<void>();
  readonly verLote = output<any>();
  readonly asignarOtro = output<void>();

  readonly lotes = signal<any[]>([]);
  readonly cargando = signal(true);
  readonly error = signal(false);

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set(false);
    this.admin.getLotes(undefined, undefined, this.comunero().id).subscribe({
      next: (res) => {
        this.lotes.set(res?.data ?? []);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set(true);
        this.cargando.set(false);
      }
    });
  }
}
