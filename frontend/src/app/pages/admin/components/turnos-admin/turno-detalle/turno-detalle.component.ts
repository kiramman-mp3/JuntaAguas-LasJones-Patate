import { Component, input, output } from '@angular/core';
import { ModalComponent } from '../../../../../shared/ui/modal.component';
import { Turno } from '../turno.model';

/** Ficha de un turno de riego. */
@Component({
  selector: 'app-turno-detalle',
  standalone: true,
  imports: [ModalComponent],
  template: `
    @let t = turno();
    <app-modal titulo="Detalle del turno" [subtitulo]="t.dia + ' · ' + t.horaInicio + ' – ' + t.horaFin" icono="ri-time-line" tamano="sm" (cerrar)="cerrar.emit()">
      <div class="modal__body form-stack">
        <div class="selected-person">
          <span class="avatar" aria-hidden="true"><i class="ri-user-fill"></i></span>
          <div>
            <strong>{{ t.usuario }}</strong>
            <span>Comunero beneficiario</span>
          </div>
          <span class="badge" [class.badge--success]="t.tipo === 'REGULAR'" [class.badge--warning]="t.tipo !== 'REGULAR'">
            {{ t.tipo === 'REGULAR' ? 'Regular' : 'Adicional' }}
          </span>
        </div>
        <dl class="fact-grid">
          <div><dt>Lote</dt><dd>{{ t.lote }}</dd></div>
          <div><dt>Sector</dt><dd>{{ t.sector }}</dd></div>
          <div><dt>Día</dt><dd>{{ t.dia }}</dd></div>
          <div><dt>Horario</dt><dd class="money">{{ t.horaInicio }} – {{ t.horaFin }}</dd></div>
        </dl>
        <section class="detail-section">
          <h4 class="detail-section__title"><i class="ri-sticky-note-line" aria-hidden="true"></i> Observaciones</h4>
          <p class="prewrap" [class.text-muted]="!t.observacion">{{ t.observacion || 'Sin observaciones registradas para este turno.' }}</p>
        </section>
      </div>
      <div class="modal__footer">
        <button type="button" class="btn btn--outline" (click)="editar.emit()"><i class="ri-edit-line" aria-hidden="true"></i> Editar</button>
        <button type="button" class="btn btn--primary" (click)="cerrar.emit()">Cerrar</button>
      </div>
    </app-modal>
  `
})
export class TurnoDetalleComponent {
  readonly turno = input.required<Turno>();
  readonly cerrar = output<void>();
  readonly editar = output<void>();
}
