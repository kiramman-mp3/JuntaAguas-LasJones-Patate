import { Component, computed, input, output } from '@angular/core';
import { DIAS_SEMANA, DiaSemana, Turno } from '../turno.model';

/**
 * Calendario semanal: una columna por día. En escritorio se ven los siete días;
 * en pantallas angostas las columnas se desplazan horizontalmente con ajuste por día
 * dentro de su propio contenedor (la página nunca se desborda).
 */
@Component({
  selector: 'app-turnos-calendario',
  standalone: true,
  template: `
    <div class="week" role="list" aria-label="Turnos por día de la semana">
      @for (d of columnas(); track d.dia.valor) {
        <section class="week__day" role="listitem" [attr.aria-label]="d.dia.label + ': ' + d.turnos.length + ' turnos'">
          <header class="week__head">
            <strong>{{ d.dia.label }}</strong>
            <span class="week__count">{{ d.turnos.length }}</span>
          </header>
          <div class="week__list">
            @for (t of d.turnos; track t.id) {
              <article class="shift" [class.shift--extra]="t.tipo !== 'REGULAR'">
                <button type="button" class="shift__main" (click)="ver.emit(t)" [attr.aria-label]="'Ver turno de ' + t.usuario">
                  <span class="shift__time">{{ t.horaInicio }} – {{ t.horaFin }}</span>
                  <strong class="shift__who" [title]="t.usuario">{{ t.usuario }}</strong>
                  <span class="shift__lot"><i class="ri-landscape-line" aria-hidden="true"></i> {{ t.lote }}</span>
                </button>
                <div class="shift__actions">
                  <button type="button" class="icon-btn" (click)="editar.emit(t)" title="Editar" [attr.aria-label]="'Editar turno de ' + t.usuario">
                    <i class="ri-edit-line" aria-hidden="true"></i>
                  </button>
                  <button type="button" class="icon-btn icon-btn--danger" (click)="eliminar.emit(t)" title="Eliminar" [attr.aria-label]="'Eliminar turno de ' + t.usuario">
                    <i class="ri-delete-bin-line" aria-hidden="true"></i>
                  </button>
                </div>
              </article>
            } @empty {
              <p class="week__empty"><i class="ri-moon-clear-line" aria-hidden="true"></i> Sin turnos</p>
            }
          </div>
        </section>
      }
    </div>
  `
})
export class TurnosCalendarioComponent {
  readonly turnos = input.required<Turno[]>();
  readonly ver = output<Turno>();
  readonly editar = output<Turno>();
  readonly eliminar = output<Turno>();

  readonly columnas = computed<{ dia: DiaSemana; turnos: Turno[] }[]>(() =>
    DIAS_SEMANA.map((dia) => ({
      dia,
      turnos: this.turnos()
        .filter((t) => t.dia_semana === dia.valor)
        .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio))
    }))
  );
}
