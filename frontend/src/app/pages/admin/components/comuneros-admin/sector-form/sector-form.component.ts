import { Component, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../../../core/services/admin.service';
import { NotificationService } from '../../../../../core/services/notification.service';
import { ModalComponent } from '../../../../../shared/ui/modal.component';

/** Registro de un sector de riego. Los lotes pertenecen a un sector y su código usa su prefijo. */
@Component({
  selector: 'app-sector-form',
  standalone: true,
  imports: [FormsModule, ModalComponent],
  template: `
    <app-modal titulo="Nuevo sector" subtitulo="Los lotes se agrupan por sector y su código toma el prefijo del sector."
      icono="ri-map-2-line" tamano="sm" [bloqueado]="guardando()" (cerrar)="cerrar.emit()">
      <form (ngSubmit)="guardar()" #sectorForm="ngForm">
        <div class="modal__body form-stack">
          <div class="form-group">
            <label for="sector-nombre">Nombre del sector *</label>
            <input id="sector-nombre" class="input" name="nombre" [(ngModel)]="nombre" required minlength="2" maxlength="100"
              placeholder="Ej: La Jones Alto" />
          </div>
          <div class="form-group">
            <label for="sector-descripcion">Descripción <span class="text-muted">(opcional)</span></label>
            <input id="sector-descripcion" class="input" name="descripcion" [(ngModel)]="descripcion" maxlength="255" />
          </div>
          @if (error()) {
            <div class="alert alert--danger" role="alert">{{ error() }}</div>
          }
        </div>
        <div class="modal__footer">
          <button type="button" class="btn btn--outline" (click)="cerrar.emit()" [disabled]="guardando()">Cancelar</button>
          <button type="submit" class="btn btn--primary" [disabled]="sectorForm.invalid || guardando()">
            @if (guardando()) {
              <span class="spinner spinner--sm" aria-hidden="true"></span> Guardando…
            } @else {
              <i class="ri-save-line" aria-hidden="true"></i> Guardar sector
            }
          </button>
        </div>
      </form>
    </app-modal>
  `
})
export class SectorFormComponent {
  private admin = inject(AdminService);
  private notify = inject(NotificationService);

  readonly cerrar = output<void>();
  readonly creado = output<void>();

  readonly guardando = signal(false);
  readonly error = signal('');
  nombre = '';
  descripcion = '';

  guardar(): void {
    const nombre = this.nombre.trim();
    if (nombre.length < 2) {
      this.error.set('Ingrese el nombre del sector.');
      return;
    }
    this.guardando.set(true);
    this.error.set('');
    this.admin.createSector({ nombre, descripcion: this.descripcion.trim() || undefined }).subscribe({
      next: () => {
        this.guardando.set(false);
        this.notify.success(`Sector ${nombre} creado.`);
        this.creado.emit();
      },
      error: (err) => {
        this.guardando.set(false);
        this.error.set(err.error?.message || 'No se pudo crear el sector.');
      }
    });
  }
}
