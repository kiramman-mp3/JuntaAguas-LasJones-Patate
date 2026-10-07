import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../../core/services/admin.service';
import { DialogService } from '../../../../core/services/dialog.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { PageHeaderComponent } from '../../../../shared/ui/page-header.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state.component';
import { SkeletonComponent } from '../../../../shared/ui/skeleton.component';
import { DIAS_SEMANA, Turno, filtrarTurnos } from './turno.model';
import { TurnosService } from './turnos.service';
import { TurnosTablaComponent } from './turnos-tabla/turnos-tabla.component';
import { TurnosCalendarioComponent } from './turnos-calendario/turnos-calendario.component';
import { TurnoAsignarComponent } from './turno-asignar/turno-asignar.component';
import { TurnoEditarComponent } from './turno-editar/turno-editar.component';
import { TurnoDetalleComponent } from './turno-detalle/turno-detalle.component';

type Vista = 'TABLA' | 'CALENDARIO';
const CLAVE_VISTA = 'turnos.vista';

/**
 * Turnos semanales de riego. La tabla y el calendario son dos vistas de los mismos datos,
 * así que comparten la carga y los filtros; asignar, editar y ver detalle son componentes propios.
 */
@Component({
  selector: 'app-turnos-admin',
  standalone: true,
  imports: [
    FormsModule,
    PageHeaderComponent,
    EmptyStateComponent,
    SkeletonComponent,
    TurnosTablaComponent,
    TurnosCalendarioComponent,
    TurnoAsignarComponent,
    TurnoEditarComponent,
    TurnoDetalleComponent
  ],
  templateUrl: './turnos-admin.component.html'
})
export class TurnosAdminComponent implements OnInit {
  private servicio = inject(TurnosService);
  private admin = inject(AdminService);
  private dialog = inject(DialogService);
  private notify = inject(NotificationService);

  readonly dias = DIAS_SEMANA;
  readonly turnos = signal<Turno[]>([]);
  readonly cargando = signal(true);
  readonly error = signal(false);
  readonly vista = signal<Vista>(this.vistaGuardada());

  readonly busqueda = signal('');
  readonly diaFiltro = signal('');
  readonly tipoFiltro = signal('');

  readonly asignarAbierto = signal(false);
  readonly enEdicion = signal<Turno | null>(null);
  readonly enDetalle = signal<Turno | null>(null);

  readonly filtrados = computed(() => filtrarTurnos(this.turnos(), { busqueda: this.busqueda(), dia: this.diaFiltro(), tipo: this.tipoFiltro() }));
  readonly hayFiltros = computed(() => !!this.busqueda().trim() || !!this.diaFiltro() || !!this.tipoFiltro());

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set(false);
    this.servicio.listar().subscribe({
      next: (turnos) => {
        this.turnos.set(turnos);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set(true);
        this.cargando.set(false);
      }
    });
  }

  cambiarVista(vista: Vista): void {
    this.vista.set(vista);
    try {
      localStorage.setItem(CLAVE_VISTA, vista);
    } catch {
      /* Sin almacenamiento disponible: la vista se recuerda solo en esta sesión. */
    }
  }

  limpiarFiltros(): void {
    this.busqueda.set('');
    this.diaFiltro.set('');
    this.tipoFiltro.set('');
  }

  onAsignado(): void {
    this.asignarAbierto.set(false);
    this.cargar();
  }

  onEditado(): void {
    this.enEdicion.set(null);
    this.cargar();
  }

  editarDesdeDetalle(turno: Turno): void {
    this.enDetalle.set(null);
    this.enEdicion.set(turno);
  }

  async eliminar(turno: Turno): Promise<void> {
    const confirmado = await this.dialog.confirmar({
      tipo: 'DANGER',
      titulo: 'Eliminar turno',
      mensaje: `¿Eliminar el turno de "${turno.usuario}" (${turno.dia} ${turno.horaInicio} – ${turno.horaFin})?`,
      textoConfirmar: 'Eliminar'
    });
    if (!confirmado) return;
    this.admin.eliminarTurno(turno.id).subscribe({
      next: (res: any) => {
        this.turnos.update((lista) => lista.filter((t) => t.id !== turno.id));
        this.notify.success(res.message || 'Turno eliminado.');
      },
      error: (err: any) => this.notify.error(err.error?.message || 'Error al eliminar el turno.')
    });
  }

  private vistaGuardada(): Vista {
    try {
      return localStorage.getItem(CLAVE_VISTA) === 'CALENDARIO' ? 'CALENDARIO' : 'TABLA';
    } catch {
      return 'TABLA';
    }
  }
}
