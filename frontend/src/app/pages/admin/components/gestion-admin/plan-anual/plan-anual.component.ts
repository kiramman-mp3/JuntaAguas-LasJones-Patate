import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ActividadPlan,
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
import { AYUDAS_FORMULARIO } from '../../../../../core/directives/formularios';

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
  imports: [
    FormsModule,
    ...AYUDAS_FORMULARIO,
    FechaLocalPipe,
    EmptyStateComponent,
    SkeletonComponent,
    ModalComponent,
  ],
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
              <div
                class="table-scroll"
                tabindex="0"
                role="region"
                [attr.aria-label]="'Actividades del plan ' + p.anio"
              >
                <table class="fin-table">
                  <thead>
                    <tr>
                      <th scope="col">Actividad</th>
                      <th scope="col">Desde</th>
                      <th scope="col">Hasta</th>
                      <th scope="col">Estado</th>
                      @if (p.estado !== 'CERRADO') {
                        <th scope="col">Acciones</th>
                      }
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
                          @if (a.fecha_cumplimiento) {
                            <br /><span class="fin-table__muted"
                              >Cumplida el {{ a.fecha_cumplimiento | fechaLocal }}</span
                            >
                          }
                          @if (a.observacion_resultado) {
                            <br /><span class="fin-table__muted">{{
                              a.observacion_resultado
                            }}</span>
                          }
                        </td>
                        @if (p.estado !== 'CERRADO') {
                          <td>
                            <button
                              type="button"
                              class="btn btn--ghost btn--sm"
                              [attr.aria-label]="'Editar actividad ' + a.nombre"
                              (click)="editarActividad(p, a)"
                            >
                              <i class="ri-edit-line" aria-hidden="true"></i> Editar
                            </button>
                          </td>
                        }
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
            <p class="form-legend">
              <span class="req" aria-hidden="true">*</span> Campos obligatorios
            </p>
            <div class="form-group">
              <label for="plan-anio">Año <span class="req" aria-hidden="true">*</span></label>
              <input
                id="plan-anio"
                name="anio"
                class="input"
                type="number"
                min="2000"
                max="2100"
                required
                placeholder="Ej. 2027"
                [(ngModel)]="anio"
              />
            </div>
            <div class="form-group">
              <label for="plan-descripcion">Descripción <span class="opt">(Opcional)</span></label>
              <input
                id="plan-descripcion"
                name="descripcion"
                class="input"
                maxlength="255"
                placeholder="Ej. Plan de trabajo de la directiva 2027"
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
        [titulo]="(editandoId() ? 'Editar actividad del plan ' : 'Actividad del plan ') + plan.anio"
        [icono]="editandoId() ? 'ri-edit-line' : 'ri-add-line'"
        [bloqueado]="guardando()"
        (cerrar)="planDeActividad.set(null)"
      >
        <form (ngSubmit)="guardarActividad(plan)">
          <div class="modal__body form-stack">
            <p class="form-legend">
              <span class="req" aria-hidden="true">*</span> Campos obligatorios
            </p>
            <div class="form-group">
              <label for="act-nombre"
                >Actividad <span class="req" aria-hidden="true">*</span></label
              >
              <input
                id="act-nombre"
                name="nombre"
                class="input"
                maxlength="200"
                required
                placeholder="Ej. Limpieza general del canal de riego"
                [(ngModel)]="actividad.nombre"
              />
            </div>
            <div class="grid-2">
              <div class="form-group">
                <label for="act-inicio">Desde <span class="req" aria-hidden="true">*</span></label>
                <input
                  id="act-inicio"
                  name="inicio"
                  class="input"
                  type="date"
                  required
                  [(ngModel)]="actividad.fecha_inicio"
                />
              </div>
              <div class="form-group">
                <label for="act-fin">Hasta <span class="req" aria-hidden="true">*</span></label>
                <input
                  id="act-fin"
                  name="fin"
                  class="input"
                  type="date"
                  required
                  [(ngModel)]="actividad.fecha_fin"
                />
              </div>
            </div>
            <div class="form-group">
              <label for="act-descripcion">Descripción <span class="opt">(Opcional)</span></label>
              <textarea
                id="act-descripcion"
                name="descripcion"
                class="input"
                rows="2"
                placeholder="Ej. Participan todos los sectores; llevar pala y botas"
                [(ngModel)]="actividad.descripcion"
              ></textarea>
            </div>
            @if (editandoId()) {
              <div class="form-group">
                <label for="act-estado">Estado <span class="req" aria-hidden="true">*</span></label>
                <select
                  id="act-estado"
                  name="estado"
                  class="input"
                  required
                  [(ngModel)]="edicion.estado"
                >
                  @for (e of estados; track e.valor) {
                    <option [ngValue]="e.valor">{{ e.etiqueta }}</option>
                  }
                </select>
              </div>
              @if (edicion.estado === 'CUMPLIDA') {
                <div class="form-group">
                  <label for="act-cumplimiento"
                    >Fecha de cumplimiento <span class="req" aria-hidden="true">*</span></label
                  >
                  <input
                    id="act-cumplimiento"
                    name="cumplimiento"
                    class="input"
                    type="date"
                    [max]="hoy"
                    required
                    [(ngModel)]="edicion.fecha_cumplimiento"
                  />
                </div>
              }
              <div class="form-group">
                <label for="act-resultado"
                  >Resultado u observación <span class="opt">(Opcional)</span></label
                >
                <textarea
                  id="act-resultado"
                  name="resultado"
                  class="input"
                  rows="2"
                  [(ngModel)]="edicion.observacion_resultado"
                ></textarea>
              </div>
            }
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
              {{
                guardando() ? 'Guardando…' : editandoId() ? 'Guardar cambios' : 'Agregar actividad'
              }}
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
  readonly estados = (Object.keys(ETIQUETA_ESTADO) as EstadoActividad[]).map((valor) => ({
    valor,
    etiqueta: ETIQUETA_ESTADO[valor],
  }));
  readonly hoy = hoyEnEcuador();
  readonly planes = signal<PlanAnual[]>([]);
  readonly cargando = signal(false);
  readonly error = signal('');
  readonly guardando = signal(false);
  readonly planAbierto = signal(false);
  readonly planDeActividad = signal<PlanAnual | null>(null);
  /** Id de la actividad que se edita; null cuando el formulario agrega una nueva. */
  readonly editandoId = signal<number | null>(null);

  anio = Number(hoyEnEcuador().slice(0, 4));
  descripcion = '';
  actividad: NuevaActividad = { nombre: '', fecha_inicio: '', fecha_fin: '', descripcion: '' };
  edicion: {
    estado: EstadoActividad;
    fecha_cumplimiento: string;
    observacion_resultado: string;
  } = { estado: 'PENDIENTE', fecha_cumplimiento: '', observacion_resultado: '' };

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

  editarActividad(plan: PlanAnual, act: ActividadPlan): void {
    this.editandoId.set(act.id);
    this.actividad = {
      nombre: act.nombre,
      fecha_inicio: act.fecha_inicio,
      fecha_fin: act.fecha_fin,
      descripcion: act.descripcion ?? '',
    };
    this.edicion = {
      estado: act.estado,
      fecha_cumplimiento: act.fecha_cumplimiento ?? '',
      observacion_resultado: act.observacion_resultado ?? '',
    };
    this.planDeActividad.set(plan);
  }

  abrirActividad(plan: PlanAnual): void {
    this.editandoId.set(null);
    this.actividad = {
      nombre: '',
      fecha_inicio: `${plan.anio}-01-01`,
      fecha_fin: `${plan.anio}-12-31`,
      descripcion: '',
    };
    this.planDeActividad.set(plan);
  }

  guardarPlan(): void {
    if (this.guardando()) return;
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
    if (this.guardando()) return;
    const a = this.actividad;
    if (a.nombre.trim().length < 3)
      return this.notify.warning('Describa la actividad (mínimo 3 caracteres).');
    if (!a.fecha_inicio || !a.fecha_fin || a.fecha_inicio > a.fecha_fin)
      return this.notify.warning('La fecha de inicio debe ser anterior o igual a la de fin.');
    const id = this.editandoId();
    if (id) return this.actualizarActividad(plan, id);
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

  private actualizarActividad(plan: PlanAnual, id: number): void {
    const a = this.actividad;
    const e = this.edicion;
    const cumplida = e.estado === 'CUMPLIDA';
    if (cumplida && !e.fecha_cumplimiento)
      return this.notify.warning('Indique la fecha en que se cumplió la actividad.');
    this.guardando.set(true);
    this.gestion
      .actualizarActividad(plan.id, id, {
        nombre: a.nombre.trim(),
        descripcion: a.descripcion?.trim() ?? '',
        fecha_inicio: a.fecha_inicio,
        fecha_fin: a.fecha_fin,
        estado: e.estado,
        fecha_cumplimiento: cumplida ? e.fecha_cumplimiento : null,
        observacion_resultado: e.observacion_resultado.trim() || null,
      })
      .subscribe({
        next: (res) =>
          this.terminar(res.message || 'Actividad actualizada.', () =>
            this.planDeActividad.set(null),
          ),
        error: (err) => this.fallo(err, 'No se pudo actualizar la actividad.'),
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
