import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GestionService, RegistroAuditoria } from '../../../../../core/services/gestion.service';
import { hoyEnEcuador, sumarDias } from '../../../../../core/utils/fechas';
import { mensajeError } from '../../../../../core/utils/errores';
import { FechaLocalPipe } from '../../../../../shared/pipes/fecha-local.pipe';
import { EmptyStateComponent } from '../../../../../shared/ui/empty-state.component';
import { PaginadorComponent } from '../../../../../shared/ui/paginador.component';
import { SkeletonComponent } from '../../../../../shared/ui/skeleton.component';

/** Acciones que registra el sistema, para filtrar el registro. */
const ACCIONES = [
  'LOGIN',
  'LOGOUT',
  'BLOQUEO',
  'CREAR',
  'MODIFICAR',
  'ANULAR',
  'ELIMINAR',
  'PAGO',
  'TRANSFERIR',
  'CONVOCAR',
];

/**
 * Registro de auditoría de solo lectura: quién hizo cada cambio, cuándo y desde qué IP.
 * Los filtros por día usan el calendario de Ecuador (el servidor los traduce a UTC).
 */
@Component({
  selector: 'app-auditoria',
  standalone: true,
  imports: [
    FormsModule,
    FechaLocalPipe,
    EmptyStateComponent,
    SkeletonComponent,
    PaginadorComponent,
  ],
  template: `
    <section class="fin-panel" aria-labelledby="auditoria-titulo">
      <div class="fin-panel__head">
        <div>
          <h3 class="fin-panel__title" id="auditoria-titulo">
            <i class="ri-shield-check-line" aria-hidden="true"></i> Registro de auditoría
          </h3>
          <p class="fin-panel__desc">
            Registros que coinciden con los filtros, del más reciente al más antiguo.
          </p>
        </div>
      </div>

      <form class="field-row" style="margin-bottom: 1rem" (ngSubmit)="filtrar()">
        <div class="field">
          <label for="aud-desde">Desde</label>
          <input
            id="aud-desde"
            name="desde"
            class="input"
            type="date"
            [ngModel]="desde()"
            (ngModelChange)="desde.set($event); filtrar()"
          />
        </div>
        <div class="field">
          <label for="aud-hasta">Hasta</label>
          <input
            id="aud-hasta"
            name="hasta"
            class="input"
            type="date"
            [ngModel]="hasta()"
            (ngModelChange)="hasta.set($event); filtrar()"
          />
        </div>
        <div class="field">
          <label for="aud-accion">Acción</label>
          <select
            id="aud-accion"
            name="accion"
            class="input"
            [ngModel]="accion()"
            (ngModelChange)="accion.set($event); filtrar()"
          >
            <option value="">Todas</option>
            @for (a of acciones; track a) {
              <option [value]="a">{{ a }}</option>
            }
          </select>
        </div>
        <div class="field">
          <label for="aud-entidad">Entidad</label>
          <input
            id="aud-entidad"
            name="entidad"
            class="input"
            type="search"
            placeholder="pagos, cuentas, eventos…"
            [ngModel]="entidad()"
            (ngModelChange)="entidad.set($event)"
            (keyup.enter)="filtrar()"
            (blur)="filtrarSiCambioEntidad()"
          />
        </div>
      </form>

      @if (error()) {
        <app-empty-state
          tono="error"
          icono="ri-wifi-off-line"
          titulo="No se pudo cargar la auditoría"
          [mensaje]="error()"
        >
          <button type="button" class="btn btn--outline btn--sm" (click)="cargar()">
            Reintentar
          </button>
        </app-empty-state>
      } @else if (cargando() && !registros().length) {
        <app-skeleton [filas]="6" mensaje="Cargando auditoría…" />
      } @else if (!registros().length) {
        <app-empty-state
          icono="ri-shield-check-line"
          titulo="Sin registros"
          mensaje="No hay acciones registradas con esos filtros."
        />
      } @else {
        <div class="table-scroll" tabindex="0" role="region" aria-label="Tabla de auditoría">
          <table class="fin-table">
            <thead>
              <tr>
                <th scope="col">Fecha</th>
                <th scope="col">Usuario</th>
                <th scope="col">Acción</th>
                <th scope="col">Entidad</th>
                <th scope="col">Detalle</th>
                <th scope="col">IP</th>
              </tr>
            </thead>
            <tbody>
              @for (r of registros(); track r.id) {
                <tr>
                  <td>{{ r.fecha | fechaLocal: 'conHora' }}</td>
                  <td>
                    {{ r.persona_nombre || 'Sistema' }}
                    @if (r.cuenta_usuario) {
                      <br /><span class="fin-table__muted">{{ r.cuenta_usuario }}</span>
                    }
                  </td>
                  <td>
                    <span class="badge badge--neutral">{{ r.accion }}</span>
                  </td>
                  <td>
                    {{ r.entidad }}
                    @if (r.entidad_id) {
                      <span class="fin-table__muted"> #{{ r.entidad_id }}</span>
                    }
                  </td>
                  <td class="fin-table__muted" style="max-width: 28rem; overflow-wrap: anywhere">
                    {{ resumen(r) }}
                  </td>
                  <td class="fin-table__muted">{{ r.ip || '—' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <app-paginador
          etiqueta="registros"
          [pagina]="pagina()"
          [porPagina]="porPagina()"
          [total]="total()"
          [cargando]="cargando()"
          (paginaChange)="cambiarPagina($event)"
          (porPaginaChange)="cambiarPorPagina($event)"
        />
      }
    </section>
  `,
})
export class AuditoriaComponent {
  private gestion = inject(GestionService);

  readonly acciones = ACCIONES;
  readonly pagina = signal(1);
  readonly porPagina = signal(25);
  readonly total = signal(0);
  readonly desde = signal(sumarDias(hoyEnEcuador(), -30));
  readonly hasta = signal(hoyEnEcuador());
  readonly accion = signal('');
  readonly entidad = signal('');
  readonly registros = signal<RegistroAuditoria[]>([]);
  readonly cargando = signal(false);
  readonly error = signal('');

  /** Entidad con la que se pidió el último listado, para no recargar al salir del campo sin cambios. */
  private entidadAplicada = '';

  constructor() {
    this.cargar();
  }

  /** Aplica un filtro nuevo: vuelve a la primera página. */
  filtrar(): void {
    this.pagina.set(1);
    this.cargar();
  }

  filtrarSiCambioEntidad(): void {
    if (this.entidad().trim() !== this.entidadAplicada) this.filtrar();
  }

  cambiarPagina(nueva: number): void {
    this.pagina.set(nueva);
    this.cargar();
  }

  cambiarPorPagina(cantidad: number): void {
    this.porPagina.set(cantidad);
    this.filtrar();
  }

  cargar(): void {
    if (this.desde() && this.hasta() && this.desde() > this.hasta()) {
      this.error.set('La fecha inicial debe ser anterior a la final.');
      return;
    }
    this.cargando.set(true);
    this.error.set('');
    this.entidadAplicada = this.entidad().trim();
    this.gestion
      .getAuditoria({
        desde: this.desde() || undefined,
        hasta: this.hasta() || undefined,
        accion: this.accion() || undefined,
        entidad: this.entidadAplicada || undefined,
        page: this.pagina(),
        limit: this.porPagina(),
      })
      .subscribe({
        next: (res) => {
          this.registros.set(res.data);
          this.total.set(res.pagination.total);
          this.cargando.set(false);
        },
        error: (err) => {
          this.cargando.set(false);
          this.error.set(mensajeError(err, 'Revise su conexión e intente nuevamente.'));
        },
      });
  }

  /** Detalle del registro en una línea legible ("clave: valor · clave: valor"). */
  resumen(r: RegistroAuditoria): string {
    let detalle = r.detalle;
    if (typeof detalle === 'string') {
      try {
        detalle = JSON.parse(detalle) as Record<string, unknown>;
      } catch {
        return detalle as string;
      }
    }
    if (!detalle || typeof detalle !== 'object') return '—';
    return Object.entries(detalle)
      .map(
        ([clave, valor]) =>
          `${clave}: ${typeof valor === 'object' && valor !== null ? JSON.stringify(valor) : String(valor)}`,
      )
      .join(' · ');
  }
}
