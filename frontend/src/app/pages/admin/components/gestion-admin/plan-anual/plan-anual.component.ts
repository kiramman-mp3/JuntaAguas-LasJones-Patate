import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  EstadoActividad,
  GestionService,
  NuevaActividad,
  PlanAnual,
} from '../../../../../core/services/gestion.service';
import { NotificationService } from '../../../../../core/services/notification.service';
import { hoyEnEcuador } from '../../../../../core/utils/fechas';
import { mensajeError } from '../../../../../core/utils/errores';
import { FechaLocalPipe } from '../../../../../shared/pipes/fecha-local.pipe';
import { EmptyStateComponent } from '../../../../../shared/ui/empty-state.component';
import { SkeletonComponent } from '../../../../../shared/ui/skeleton.component';
import { ModalComponent } from '../../../../../shared/ui/modal.component';

const ETIQUETA_ESTADO: Record<EstadoActividad, string> = {
  PENDIENTE: 'Pendiente',
  EN_PROCESO: 'En proceso',
  CUMPLIDA: 'Cumplida',
  NO_CUMPLIDA: 'No cumplida',
  CANCELADA: 'Cancelada',
};

/** Plan operativo anual de la Junta: un plan por año con sus actividades y fechas. */
@Component({
  selector: 'app-plan-anual',
  standalone: true,
  imports: [FormsModule, FechaLocalPipe, EmptyStateComponent, SkeletonComponent, ModalComponent],
  template: `
    <section class="fin-panel" aria-labelledby="plan-titulo">
      <div class="fin-panel__head">
        <div>
          <h3 class="fin-panel__title" id="plan-titulo">
            <i class="ri-calendar-todo-line" aria-hidden="true"></i> Plan anual
          </h3>
          <p class="fin-panel__desc">Actividades planificadas por la directiva para cada año.</p>
        </div>
        <button type="button" class="btn btn--primary btn--sm pressable" (click)="abrirPlan()">
          <i class="ri-add-line" aria-hidden="true"></i> Nuevo plan
        </button>
      </div>

      @if (error()) {
        <app-empty-state
          tono="error"
          icono="ri-wifi-off-line"
          titulo="No se pudieron cargar los planes"
          [mensaje]="error()"
        >
          <button type="button" class="btn btn--outline btn--sm" (click)="cargar()">
            Reintentar
          </button>
        </app-empty-state>
      } @else if (cargando() && !planes().length) {
        <app-skeleton [filas]="4" mensaje="Cargando planes…" />
      } @else if (!planes().length) {
        <app-empty-state
          icono="ri-calendar-todo-line"
          titulo="Sin planes"
          mensaje="Cree el plan del año para registrar sus actividades."
        />
      } @else {
        @for (p of planes(); track p.id) {
          <article class="card" style="margin-top: 1rem; padding: 1rem">
            <div class="fin-panel__head">
              <div>
                <h4 class="fin-panel__title">
                  Plan {{ p.anio }} <span class="badge badge--neutral">{{ p.estado }}</span>
                </h4>
                @if (p.descripcion) {
                  <p class="fin-panel__desc">{{ p.descripcion }}</p>
                }
              </div>
              @if (p.estado !== 'CERRADO') {
                <button
                  type="button"
                  class="btn btn--outline btn--sm pressable"
                  (click)="abrirActividad(p)"
                >
                  <i class="ri-add-line" aria-hidden="true"></i> Actividad
                </button>
              }
            </div>
            @if (p.actividades.length) {
              <div class="table-scroll">
                <table class="fin-table">
                  <thead>
                    <tr>
                      <th scope="col">Actividad</th>
                      <th scope="col">Desde</th>
                      <th scope="col">Hasta</th>
                      <th scope="col">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (a of p.actividades; track a.id) {
                      <tr>
                        <td>
                          {{ a.nombre }}
                          @if (a.descripcion) {
                            <br /><span class="fin-table__muted">{{ a.descripcion }}</span>
                          }
                        </td>
                        <td>{{ a.fecha_inicio | fechaLocal }}</td>
                        <td>{{ a.fecha_fin | fechaLocal }}</td>
                        <td>
                          <span
                            class="badge"
                            [class.badge--success]="a.estado === 'CUMPLIDA'"
                            [class.badge--info]="a.estado === 'EN_PROCESO'"
                            [class.badge--danger]="
                              a.estado === 'NO_CUMPLIDA' || a.estado === 'CANCELADA'
                            "
                            >{{ etiquetas[a.estado] }}</span
                          >
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            } @else {
              <p class="text-muted">Este plan aún no tiene actividades.</p>
            }
          </article>
        }
      }
    </section>

    @if (planAbierto()) {
      <app-modal
        titulo="Nuevo plan anual"
        icono="ri-calendar-todo-line"
        tamano="sm"
        [bloqueado]="guardando()"
        (cerrar)="planAbierto.set(false)"
      >
        <form (ngSubmit)="guardarPlan()">
          <div class="modal__body form-stack">
            <div class="form-group">
              <label for="plan-anio">Año *</label>
              <input
                id="plan-anio"
                name="anio"
                class="input"
                type="number"
                min="2000"
                max="2100"
                [(ngModel)]="anio"
              />
            </div>
            <div class="form-group">
              <label for="plan-descripcion">Descripción</label>
              <input
                id="plan-descripcion"
                name="descripcion"
                class="input"
                maxlength="255"
                [(ngModel)]="descripcion"
              />
            </div>
          </div>
          <div class="modal__footer">
            <button
              type="button"
              class="btn btn--outline"
              [disabled]="guardando()"
              (click)="planAbierto.set(false)"
            >
              Cancelar
            </button>
            <button type="submit" class="btn btn--primary" [disabled]="guardando()">
              {{ guardando() ? 'Guardando…' : 'Crear plan' }}
            </button>
          </div>
        </form>
      </app-modal>
    }

    @if (planDeActividad(); as plan) {
      <app-modal
        [titulo]="'Actividad del plan ' + plan.anio"
        icono="ri-add-line"
        [bloqueado]="guardando()"
        (cerrar)="planDeActividad.set(null)"
      >
        <form (ngSubmit)="guardarActividad(plan)">
          <div class="modal__body form-stack">
            <div class="form-group">
              <label for="act-nombre">Actividad *</label>
              <input
                id="act-nombre"
                name="nombre"
                class="input"
                maxlength="200"
                [(ngModel)]="actividad.nombre"
              />
            </div>
            <div class="grid-2">
              <div class="form-group">
                <label for="act-inicio">Desde *</label>
                <input
                  id="act-inicio"
                  name="inicio"
                  class="input"
                  type="date"
                  [(ngModel)]="actividad.fecha_inicio"
                />
              </div>
              <div class="form-group">
                <label for="act-fin">Hasta *</label>
                <input
                  id="act-fin"
                  name="fin"
                  class="input"
                  type="date"
                  [(ngModel)]="actividad.fecha_fin"
                />
              </div>
            </div>
            <div class="form-group">
              <label for="act-descripcion">Descripción</label>
              <textarea
                id="act-descripcion"
                name="descripcion"
                class="input"
                rows="2"
                [(ngModel)]="actividad.descripcion"
              ></textarea>
            </div>
          </div>
          <div class="modal__footer">
            <button
              type="button"
              class="btn btn--outline"
              [disabled]="guardando()"
              (click)="planDeActividad.set(null)"
            >
              Cancelar
            </button>
            <button type="submit" class="btn btn--primary" [disabled]="guardando()">
              {{ guardando() ? 'Guardando…' : 'Agregar actividad' }}
            </button>
          </div>
        </form>
      </app-modal>
    }
  `,
})
export class PlanAnualComponent {
  private gestion = inject(GestionService);
  private notify = inject(NotificationService);

  readonly etiquetas = ETIQUETA_ESTADO;
  readonly planes = signal<PlanAnual[]>([]);
  readonly cargando = signal(false);
  readonly error = signal('');
  readonly guardando = signal(false);
  readonly planAbierto = signal(false);
  readonly planDeActividad = signal<PlanAnual | null>(null);

  anio = Number(hoyEnEcuador().slice(0, 4));
  descripcion = '';
  actividad: NuevaActividad = { nombre: '', fecha_inicio: '', fecha_fin: '', descripcion: '' };

  constructor() {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set('');
    this.gestion.getPlanes().subscribe({
      next: (res) => {
        this.planes.set(res.data);
        this.cargando.set(false);
      },
      error: (err) => {
        this.cargando.set(false);
        this.error.set(mensajeError(err, 'Revise su conexión e intente nuevamente.'));
      },
    });
  }

  abrirPlan(): void {
    this.anio = Number(hoyEnEcuador().slice(0, 4));
    this.descripcion = '';
    this.planAbierto.set(true);
  }

  abrirActividad(plan: PlanAnual): void {
    this.actividad = {
      nombre: '',
      fecha_inicio: `${plan.anio}-01-01`,
      fecha_fin: `${plan.anio}-12-31`,
      descripcion: '',
    };
    this.planDeActividad.set(plan);
  }

  guardarPlan(): void {
    if (!Number.isInteger(Number(this.anio)) || this.anio < 2000 || this.anio > 2100)
      return this.notify.warning('Indique un año válido.');
    this.guardando.set(true);
    this.gestion.crearPlan(Number(this.anio), this.descripcion.trim() || undefined).subscribe({
      next: (res) =>
        this.terminar(res.message || 'Plan anual registrado.', () => this.planAbierto.set(false)),
      error: (err) => this.fallo(err, 'No se pudo crear el plan.'),
    });
  }

  guardarActividad(plan: PlanAnual): void {
    const a = this.actividad;
    if (a.nombre.trim().length < 3)
      return this.notify.warning('Describa la actividad (mínimo 3 caracteres).');
    if (!a.fecha_inicio || !a.fecha_fin || a.fecha_inicio > a.fecha_fin)
      return this.notify.warning('La fecha de inicio debe ser anterior o igual a la de fin.');
    this.guardando.set(true);
    this.gestion
      .agregarActividad(plan.id, {
        ...a,
        nombre: a.nombre.trim(),
        descripcion: a.descripcion?.trim() || undefined,
      })
      .subscribe({
        next: (res) =>
          this.terminar(res.message || 'Actividad añadida.', () => this.planDeActividad.set(null)),
        error: (err) => this.fallo(err, 'No se pudo agregar la actividad.'),
      });
  }

  private terminar(mensaje: string, cerrar: () => void): void {
    this.guardando.set(false);
    cerrar();
    this.notify.success(mensaje);
    this.cargar();
  }

  private fallo(err: unknown, porDefecto: string): void {
    this.guardando.set(false);
    this.notify.error(mensajeError(err, porDefecto));
  }
}
