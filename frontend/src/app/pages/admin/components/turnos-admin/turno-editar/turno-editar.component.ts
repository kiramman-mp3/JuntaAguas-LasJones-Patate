import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../../../core/services/admin.service';
import { NotificationService } from '../../../../../core/services/notification.service';
import { ModalComponent } from '../../../../../shared/ui/modal.component';
import { DIAS_SEMANA, Turno } from '../turno.model';

/** Edición del horario, tipo y observaciones de un turno existente. */
@Component({
  selector: 'app-turno-editar',
  standalone: true,
  imports: [FormsModule, ModalComponent],
  template: `
    <app-modal titulo="Editar turno" [subtitulo]="turno().usuario + ' · Lote ' + turno().lote" icono="ri-edit-line" tamano="sm"
      [bloqueado]="guardando()" (cerrar)="cerrar.emit()">
      <form (ngSubmit)="guardar()">
        <div class="modal__body form-stack">
          <div class="grid-2">
            <div class="form-group">
              <label for="edit-tipo">Tipo de turno *</label>
              <select id="edit-tipo" class="input" name="tipo" [(ngModel)]="form.tipo">
                <option value="REGULAR">Regular (semanal fijo)</option>
                <option value="ADICIONAL">Adicional (comprado extra)</option>
              </select>
            </div>
            <div class="form-group">
              <label for="edit-dia">Día *</label>
              <select id="edit-dia" class="input" name="dia" [(ngModel)]="form.dia_semana">
                @for (d of dias; track d.valor) {
                  <option [ngValue]="d.valor">{{ d.label }}</option>
                }
              </select>
            </div>
            <div class="form-group">
              <label for="edit-inicio">Hora inicio *</label>
              <input id="edit-inicio" type="time" class="input" name="inicio" [(ngModel)]="form.hora_inicio" />
            </div>
            <div class="form-group">
              <label for="edit-fin">Hora fin *</label>
              <input id="edit-fin" type="time" class="input" name="fin" [(ngModel)]="form.hora_fin" />
            </div>
          </div>
          <div class="form-group">
            <label for="edit-obs">Observaciones <span class="text-muted">(opcional)</span></label>
            <textarea id="edit-obs" class="input" name="obs" [(ngModel)]="form.observacion" rows="2" placeholder="Observaciones del turno…"></textarea>
          </div>
        </div>
        <div class="modal__footer">
          <button type="button" class="btn btn--outline" (click)="cerrar.emit()" [disabled]="guardando()">Cancelar</button>
          <button type="submit" class="btn btn--primary" [disabled]="guardando()">
            @if (guardando()) {
              <span class="spinner spinner--sm" aria-hidden="true"></span> Guardando…
            } @else {
              <i class="ri-save-line" aria-hidden="true"></i> Guardar cambios
            }
          </button>
        </div>
      </form>
    </app-modal>
  `
})
export class TurnoEditarComponent implements OnInit {
  private admin = inject(AdminService);
  private notify = inject(NotificationService);

  readonly turno = input.required<Turno>();
  readonly cerrar = output<void>();
  readonly guardado = output<void>();

  readonly dias = DIAS_SEMANA;
  readonly guardando = signal(false);
  form = { dia_semana: 1, hora_inicio: '08:00', hora_fin: '10:00', tipo: 'REGULAR', observacion: '' };

  ngOnInit(): void {
    const t = this.turno();
    this.form = {
      dia_semana: t.dia_semana || 1,
      hora_inicio: t.horaInicio || '08:00',
      hora_fin: t.horaFin || '10:00',
      tipo: t.tipo || 'REGULAR',
      observacion: t.observacion || ''
    };
  }

  guardar(): void {
    const f = this.form;
    if (!f.dia_semana || !f.hora_inicio || !f.hora_fin) return this.notify.warning('Día de semana y horarios son requeridos.');
    if (f.hora_inicio >= f.hora_fin) return this.notify.warning('La hora de fin debe ser mayor a la hora de inicio.');

    const t = this.turno();
    this.guardando.set(true);
    this.admin.actualizarTurno(t.id, { persona_id: t.persona_id, lote_id: t.lote_id, ...f }).subscribe({
      next: (res: any) => {
        this.guardando.set(false);
        this.notify.success(res.message || 'Turno actualizado.');
        this.guardado.emit();
      },
      error: (err: any) => {
        this.guardando.set(false);
        this.notify.error(err.error?.message || 'Error al actualizar el turno.');
      }
    });
  }
}
