import { Component, computed, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DIAS_SEMANA, DiaSemana, Turno } from '../turno.model';

interface SectorAgrupado {
  nombre: string;
  totalTurnos: number;
  totalHoras: number;
  lotesUnicos: number;
  dias: {
    dia: DiaSemana;
    turnos: Turno[];
    horasDia: number;
  }[];
}

/**
 * Cronograma de agua organizado por sectores:
 * Muestra la distribución semanal del agua dividida por cada sector de riego
 * (Patate Viejo, La Merced, San Javier). Permite ver el flujo de entrega,
 * horarios, comuneros beneficiarios y lotes asignados.
 */
@Component({
  selector: 'app-turnos-cronograma',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="cronograma-container">
      <!-- Selector de sector activo -->
      <div class="cronograma-nav" role="tablist" aria-label="Filtrar por sector">
        <button
          type="button"
          class="cronograma-chip"
          [class.cronograma-chip--active]="sectorSeleccionado() === 'TODOS'"
          (click)="sectorSeleccionado.set('TODOS')"
        >
          <i class="ri-apps-line" aria-hidden="true"></i>
          <span>Todos los sectores</span>
          <span class="cronograma-chip__count">{{ turnos().length }}</span>
        </button>

        @for (sec of sectores(); track sec.nombre) {
          <button
            type="button"
            class="cronograma-chip"
            [class.cronograma-chip--active]="sectorSeleccionado() === sec.nombre"
            (click)="sectorSeleccionado.set(sec.nombre)"
          >
            <i class="ri-map-pin-2-line" aria-hidden="true"></i>
            <span>{{ sec.nombre }}</span>
            <span class="cronograma-chip__count">{{ sec.totalTurnos }}</span>
          </button>
        }
      </div>

      <!-- Secciones por Sector -->
      <div class="cronograma-sectors">
        @for (sec of sectoresVisibles(); track sec.nombre) {
          <section class="sector-block" [attr.aria-label]="'Cronograma del sector ' + sec.nombre">
            <!-- Cabecera del sector con resumen de indicadores -->
            <header class="sector-block__head">
              <div class="sector-block__title-area">
                <div class="sector-badge-icon">
                  <i class="ri-drop-fill" aria-hidden="true"></i>
                </div>
                <div>
                  <h4 class="sector-block__title">{{ sec.nombre }}</h4>
                  <p class="sector-block__meta">
                    Sector de riego oficial · Junta La Jones Patate
                  </p>
                </div>
              </div>

              <div class="sector-block__stats">
                <div class="stat-pill" title="Turnos semanales activos">
                  <i class="ri-calendar-check-line" aria-hidden="true"></i>
                  <strong>{{ sec.totalTurnos }}</strong>
                  <span>turnos</span>
                </div>
                <div class="stat-pill stat-pill--accent" title="Horas totales de riego por semana">
                  <i class="ri-time-line" aria-hidden="true"></i>
                  <strong>{{ sec.totalHoras | number: '1.0-1' }}</strong>
                  <span>horas/sem</span>
                </div>
                <div class="stat-pill" title="Lotes abastecidos en este sector">
                  <i class="ri-landscape-line" aria-hidden="true"></i>
                  <strong>{{ sec.lotesUnicos }}</strong>
                  <span>lotes</span>
                </div>
              </div>
            </header>

            <!-- Rejilla semanal de 7 días del sector -->
            <div class="sector-week" role="list">
              @for (d of sec.dias; track d.dia.valor) {
                <div
                  class="sector-day"
                  [class.sector-day--has-turnos]="d.turnos.length > 0"
                  role="listitem"
                  [attr.aria-label]="d.dia.label + ' en ' + sec.nombre"
                >
                  <div class="sector-day__head">
                    <span class="sector-day__name">{{ d.dia.label }}</span>
                    @if (d.turnos.length > 0) {
                      <span class="sector-day__badge" [title]="d.horasDia + ' horas de riego'">
                        {{ d.turnos.length }} · {{ d.horasDia | number: '1.0-1' }}h
                      </span>
                    } @else {
                      <span class="sector-day__badge sector-day__badge--empty">Sin turnos</span>
                    }
                  </div>

                  <div class="sector-day__shifts">
                    @for (t of d.turnos; track t.id) {
                      <article
                        class="cronograma-shift"
                        [class.cronograma-shift--extra]="t.tipo !== 'REGULAR'"
                      >
                        <button
                          type="button"
                          class="cronograma-shift__body"
                          (click)="ver.emit(t)"
                          [attr.aria-label]="'Ver turno de ' + t.usuario"
                        >
                          <div class="cronograma-shift__time">
                            <i class="ri-time-line" aria-hidden="true"></i>
                            <strong>{{ t.horaInicio }} – {{ t.horaFin }}</strong>
                            @if (t.tipo !== 'REGULAR') {
                              <span class="badge-mini badge-mini--warning">Extra</span>
                            }
                          </div>
                          <div class="cronograma-shift__who" [title]="t.usuario">
                            {{ t.usuario }}
                          </div>
                          <div class="cronograma-shift__lot">
                            <i class="ri-landscape-line" aria-hidden="true"></i>
                            <span>{{ t.lote }}</span>
                          </div>
                        </button>

                        <div class="cronograma-shift__actions">
                          <button
                            type="button"
                            class="icon-btn"
                            (click)="editar.emit(t)"
                            title="Editar horario"
                            [attr.aria-label]="'Editar turno de ' + t.usuario"
                          >
                            <i class="ri-edit-line" aria-hidden="true"></i>
                          </button>
                          <button
                            type="button"
                            class="icon-btn icon-btn--danger"
                            (click)="eliminar.emit(t)"
                            title="Eliminar turno"
                            [attr.aria-label]="'Eliminar turno de ' + t.usuario"
                          >
                            <i class="ri-delete-bin-line" aria-hidden="true"></i>
                          </button>
                        </div>
                      </article>
                    } @empty {
                      <div class="sector-day__empty">
                        <i class="ri-drop-line" aria-hidden="true"></i>
                        <span>Sin riego este día</span>
                      </div>
                    }
                  </div>
                </div>
              }
            </div>
          </section>
        } @empty {
          <div class="empty-cronograma">
            <i class="ri-map-2-line" aria-hidden="true"></i>
            <p>No se encontraron turnos registrados para el sector seleccionado.</p>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .cronograma-container {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
      padding: 0.5rem 1rem 1.5rem;
    }

    .cronograma-nav {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      align-items: center;
      padding-bottom: 0.25rem;
    }

    .cronograma-chip {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      padding: 0.45rem 0.85rem;
      border-radius: var(--radius-full, 9999px);
      border: 1px solid var(--border-color, rgba(0, 0, 0, 0.1));
      background: var(--bg-surface, #ffffff);
      color: var(--text-color, #1f2937);
      font-size: 0.84rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;

      i {
        font-size: 1rem;
        color: var(--text-muted, #6b7280);
      }

      &__count {
        display: inline-block;
        padding: 0.1rem 0.45rem;
        border-radius: var(--radius-full, 9999px);
        background: var(--bg-surface-hover, rgba(0, 0, 0, 0.05));
        font-size: 0.75rem;
        font-weight: 700;
        color: var(--text-muted, #6b7280);
      }

      &:hover {
        background: var(--bg-surface-hover, rgba(0, 0, 0, 0.05));
        border-color: var(--color-primary, #0284c7);
      }

      &--active {
        background: var(--color-primary, #0284c7);
        color: #ffffff;
        border-color: var(--color-primary, #0284c7);

        i {
          color: #ffffff;
        }

        .cronograma-chip__count {
          background: rgba(255, 255, 255, 0.25);
          color: #ffffff;
        }
      }
    }

    .cronograma-sectors {
      display: flex;
      flex-direction: column;
      gap: 1.75rem;
    }

    .sector-block {
      border: 1px solid var(--border-color, rgba(0, 0, 0, 0.08));
      border-radius: var(--radius-xl, 14px);
      background: var(--bg-surface, #ffffff);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
      overflow: hidden;
      transition: box-shadow 0.2s ease;

      &:hover {
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
      }

      &__head {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        padding: 1rem 1.25rem;
        background: linear-gradient(to right, rgba(2, 132, 199, 0.05), transparent);
        border-bottom: 1px solid var(--border-color, rgba(0, 0, 0, 0.06));
      }

      &__title-area {
        display: flex;
        align-items: center;
        gap: 0.85rem;
      }

      &__title {
        margin: 0;
        font-size: 1.15rem;
        font-weight: 700;
        color: var(--text-color, #111827);
        letter-spacing: -0.01em;
      }

      &__meta {
        margin: 0.15rem 0 0;
        font-size: 0.8rem;
        color: var(--text-muted, #6b7280);
      }

      &__stats {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.6rem;
      }
    }

    .sector-badge-icon {
      display: grid;
      place-items: center;
      width: 2.5rem;
      height: 2.5rem;
      border-radius: var(--radius-lg, 10px);
      background: rgba(2, 132, 199, 0.12);
      color: var(--color-primary, #0284c7);
      font-size: 1.3rem;
    }

    .stat-pill {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.35rem 0.75rem;
      border-radius: var(--radius-md, 8px);
      background: var(--bg-surface-hover, rgba(0, 0, 0, 0.04));
      font-size: 0.8rem;
      color: var(--text-color, #374151);

      i {
        color: var(--color-primary, #0284c7);
      }

      strong {
        font-weight: 700;
      }

      span {
        color: var(--text-muted, #6b7280);
        font-size: 0.75rem;
      }

      &--accent {
        background: rgba(16, 185, 129, 0.1);
        color: #065f46;

        i {
          color: #10b981;
        }
      }
    }

    .sector-week {
      display: grid;
      grid-template-columns: repeat(7, minmax(0, 1fr));
      gap: 0.5rem;
      padding: 0.85rem;
      background: var(--bg-surface-hover, rgba(0, 0, 0, 0.02));

      @media (max-width: 1200px) {
        grid-template-columns: none;
        grid-auto-flow: column;
        grid-auto-columns: minmax(190px, 35%);
        overflow-x: auto;
        overscroll-behavior-x: contain;
        scroll-snap-type: x mandatory;
        padding: 0.75rem;
      }

      @media (max-width: 640px) {
        grid-auto-columns: 80%;
      }
    }

    .sector-day {
      display: flex;
      flex-direction: column;
      min-height: 260px;
      border-radius: var(--radius-lg, 10px);
      background: var(--bg-surface, #ffffff);
      border: 1px solid var(--border-color, rgba(0, 0, 0, 0.06));
      scroll-snap-align: start;
      overflow: hidden;

      &--has-turnos {
        border-color: rgba(2, 132, 199, 0.25);
      }

      &__head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.55rem 0.7rem;
        background: var(--bg-surface-hover, rgba(0, 0, 0, 0.03));
        border-bottom: 1px solid var(--border-color, rgba(0, 0, 0, 0.05));
      }

      &__name {
        font-size: 0.82rem;
        font-weight: 700;
        color: var(--text-color, #1f2937);
      }

      &__badge {
        font-size: 0.7rem;
        font-weight: 600;
        color: var(--color-primary, #0284c7);
        padding: 0.1rem 0.4rem;
        background: rgba(2, 132, 199, 0.08);
        border-radius: var(--radius-sm, 4px);

        &--empty {
          color: var(--text-muted, #9ca3af);
          background: transparent;
        }
      }

      &__shifts {
        display: flex;
        flex-direction: column;
        gap: 0.45rem;
        padding: 0.55rem;
        overflow-y: auto;
        flex: 1;
      }

      &__empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 2.5rem 0.5rem;
        text-align: center;
        color: var(--text-muted, #9ca3af);
        font-size: 0.76rem;
        gap: 0.25rem;

        i {
          font-size: 1.25rem;
          opacity: 0.4;
        }
      }
    }

    .cronograma-shift {
      position: relative;
      border-radius: 8px;
      background: var(--bg-surface, #ffffff);
      border: 1px solid var(--border-color, rgba(0, 0, 0, 0.08));
      border-left: 3px solid var(--color-primary, #0284c7);
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
      transition: all 0.2s ease;

      &:hover {
        box-shadow: 0 3px 8px rgba(0, 0, 0, 0.08);
        transform: translateY(-1px);
      }

      &--extra {
        border-left-color: #f59e0b;
      }

      &__body {
        display: flex;
        flex-direction: column;
        gap: 0.15rem;
        width: 100%;
        padding: 0.5rem 0.55rem;
        border: 0;
        background: transparent;
        color: inherit;
        font: inherit;
        text-align: left;
        cursor: pointer;
      }

      &__time {
        display: flex;
        align-items: center;
        gap: 0.3rem;
        font-size: 0.72rem;
        color: var(--color-primary, #0284c7);

        strong {
          font-weight: 700;
          font-variant-numeric: tabular-nums;
        }

        i {
          font-size: 0.8rem;
        }
      }

      &__who {
        font-size: 0.82rem;
        font-weight: 600;
        color: var(--text-color, #1f2937);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      &__lot {
        display: flex;
        align-items: center;
        gap: 0.25rem;
        font-size: 0.72rem;
        color: var(--text-muted, #6b7280);

        i {
          font-size: 0.75rem;
        }
      }

      &__actions {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 0.15rem;
        padding: 0.15rem 0.4rem 0.35rem;
        border-top: 1px dashed var(--border-color, rgba(0, 0, 0, 0.05));
      }
    }

    .badge-mini {
      display: inline-block;
      padding: 0.05rem 0.3rem;
      border-radius: 4px;
      font-size: 0.65rem;
      font-weight: 700;

      &--warning {
        background: #fef3c7;
        color: #92400e;
      }
    }

    .empty-cronograma {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 4rem 1rem;
      text-align: center;
      color: var(--text-muted, #6b7280);

      i {
        font-size: 2.5rem;
        opacity: 0.4;
        margin-bottom: 0.5rem;
      }
    }
  `]
})
export class TurnosCronogramaComponent {
  readonly turnos = input.required<Turno[]>();
  readonly ver = output<Turno>();
  readonly editar = output<Turno>();
  readonly eliminar = output<Turno>();

  readonly sectorSeleccionado = signal<string>('TODOS');

  /** Agrupa los turnos por cada sector conocido */
  readonly sectores = computed<SectorAgrupado[]>(() => {
    const lista = this.turnos();
    const sectoresMap = new Map<string, Turno[]>();

    for (const t of lista) {
      const secNombre = t.sector || 'Sin sector';
      if (!sectoresMap.has(secNombre)) {
        sectoresMap.set(secNombre, []);
      }
      sectoresMap.get(secNombre)!.push(t);
    }

    // Ordenar los sectores alfabéticamente
    const nombres = Array.from(sectoresMap.keys()).sort();

    return nombres.map((nombre) => {
      const turnosSector = sectoresMap.get(nombre) || [];
      const lotesUnicos = new Set(turnosSector.map((t) => t.lote_id)).size;

      let totalMinutos = 0;
      for (const t of turnosSector) {
        totalMinutos += this.calcularMinutos(t.horaInicio, t.horaFin);
      }

      const dias = DIAS_SEMANA.map((dia) => {
        const turnosDia = turnosSector
          .filter((t) => t.dia_semana === dia.valor)
          .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));

        let minutosDia = 0;
        for (const td of turnosDia) {
          minutosDia += this.calcularMinutos(td.horaInicio, td.horaFin);
        }

        return {
          dia,
          turnos: turnosDia,
          horasDia: Number((minutosDia / 60).toFixed(1))
        };
      });

      return {
        nombre,
        totalTurnos: turnosSector.length,
        totalHoras: Number((totalMinutos / 60).toFixed(1)),
        lotesUnicos,
        dias
      };
    });
  });

  readonly sectoresVisibles = computed<SectorAgrupado[]>(() => {
    const seleccionado = this.sectorSeleccionado();
    if (seleccionado === 'TODOS') return this.sectores();
    return this.sectores().filter((s) => s.nombre === seleccionado);
  });

  private calcularMinutos(inicio: string, fin: string): number {
    if (!inicio || !fin) return 0;
    const [h1, m1] = inicio.split(':').map(Number);
    const [h2, m2] = fin.split(':').map(Number);
    const min1 = (h1 || 0) * 60 + (m1 || 0);
    const min2 = (h2 || 0) * 60 + (m2 || 0);
    return Math.max(0, min2 - min1);
  }
}
