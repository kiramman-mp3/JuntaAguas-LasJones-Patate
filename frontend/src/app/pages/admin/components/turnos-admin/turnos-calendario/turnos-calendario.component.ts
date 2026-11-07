import { Component, computed, input, output } from '@angular/core';
import { hoyEnEcuador } from '../../../../../core/utils/fechas';
import { DIAS_SEMANA, DiaSemana, Turno, diaSemanaDe, indiceSector } from '../turno.model';

interface GrupoHora {
  hora: string;
  turnos: Turno[];
}

interface ColumnaDia {
  dia: DiaSemana;
  total: number;
  grupos: GrupoHora[];
  esHoy: boolean;
}

/**
 * Calendario semanal: una columna por día, con los turnos agrupados por hora de inicio y el color del sector
 * en el borde de cada tarjeta. En escritorio se ven los siete días; en pantallas angostas las columnas se
 * desplazan horizontalmente con ajuste por día dentro de su propio contenedor (la página nunca se desborda).
 */
@Component({
  selector: 'app-turnos-calendario',
  standalone: true,
  template: `
    <div class="week" role="list" aria-label="Turnos por día de la semana">
      @for (d of columnas(); track d.dia.valor) {
        <section
          class="week__day"
          [class.week__day--hoy]="d.esHoy"
          role="listitem"
          [attr.aria-label]="d.dia.label + ': ' + d.total + ' turnos'"
          [attr.aria-current]="d.esHoy ? 'date' : null"
        >
          <header class="week__head">
            <strong>{{ d.dia.label }}</strong>
            @if (d.esHoy) {
              <span class="week__today">Hoy</span>
            }
            <span class="week__count">{{ d.total }}</span>
          </header>
          <div class="week__list">
            @for (g of d.grupos; track g.hora) {
              <div class="week__hour" role="presentation">
                <span>{{ g.hora }}</span>
                <span class="week__hour-count">{{ g.turnos.length }}</span>
              </div>
              @for (t of g.turnos; track t.id) {
                <article class="shift" [class]="'sector-' + colorDe(t)">
                  <button
                    type="button"
                    class="shift__main"
                    (click)="ver.emit(t)"
                    [attr.aria-label]="
                      'Ver turno de ' + t.usuario + ', ' + t.horaInicio + ' a ' + t.horaFin
                    "
                  >
                    <strong class="shift__who" [title]="t.usuario">{{ t.usuario }}</strong>
                    <span class="shift__meta" [title]="t.sector">
                      <span>hasta {{ t.horaFin }}</span>
                      <span><i class="ri-landscape-line" aria-hidden="true"></i> {{ t.lote }}</span>
                    </span>
                  </button>
                  <div class="shift__actions">
                    <button
                      type="button"
                      class="icon-btn"
                      (click)="editar.emit(t)"
                      title="Editar"
                      [attr.aria-label]="'Editar turno de ' + t.usuario"
                    >
                      <i class="ri-edit-line" aria-hidden="true"></i>
                    </button>
                    <button
                      type="button"
                      class="icon-btn icon-btn--danger"
                      (click)="eliminar.emit(t)"
                      title="Eliminar"
                      [attr.aria-label]="'Eliminar turno de ' + t.usuario"
                    >
                      <i class="ri-delete-bin-line" aria-hidden="true"></i>
                    </button>
                  </div>
                </article>
              }
            } @empty {
              <p class="week__empty">
                <i class="ri-moon-clear-line" aria-hidden="true"></i> Sin turnos
              </p>
            }
          </div>
        </section>
      }
    </div>
  `,
})
export class TurnosCalendarioComponent {
  readonly turnos = input.required<Turno[]>();
  readonly ver = output<Turno>();
  readonly editar = output<Turno>();
  readonly eliminar = output<Turno>();

  /** Día de la semana de hoy en Ecuador, para resaltar su columna. */
  private readonly hoy = diaSemanaDe(hoyEnEcuador());

  readonly columnas = computed<ColumnaDia[]>(() =>
    DIAS_SEMANA.map((dia) => {
      const delDia = this.turnos()
        .filter((t) => t.dia_semana === dia.valor)
        .sort(
          (a, b) =>
            a.horaInicio.localeCompare(b.horaInicio) || a.usuario.localeCompare(b.usuario, 'es'),
        );
      const grupos: GrupoHora[] = [];
      for (const t of delDia) {
        const ultimo = grupos[grupos.length - 1];
        if (ultimo?.hora === t.horaInicio) ultimo.turnos.push(t);
        else grupos.push({ hora: t.horaInicio, turnos: [t] });
      }
      return { dia, total: delDia.length, grupos, esHoy: dia.valor === this.hoy };
    }),
  );

  colorDe(turno: Turno): number {
    return indiceSector(turno.sector);
  }
}
