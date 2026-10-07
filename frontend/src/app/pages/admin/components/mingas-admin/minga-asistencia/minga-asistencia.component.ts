import { ChangeDetectorRef, Component, DestroyRef, OnInit, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { AdminService } from '../../../../../core/services/admin.service';
import { FechaLocalPipe } from '../../../../../shared/pipes/fecha-local.pipe';
import { ModalComponent } from '../../../../../shared/ui/modal.component';
import { SkeletonComponent } from '../../../../../shared/ui/skeleton.component';
import { EmptyStateComponent } from '../../../../../shared/ui/empty-state.component';
import { AsistenciaMinga, EstadoAsistenciaMinga, Minga } from '../minga.model';

/** Registro de asistencia de una minga. Los comuneros sin marcar quedan pendientes. */
@Component({
  selector: 'app-minga-asistencia',
  standalone: true,
  imports: [FormsModule, FechaLocalPipe, ModalComponent, SkeletonComponent, EmptyStateComponent],
  templateUrl: './minga-asistencia.component.html'
})
export class MingaAsistenciaComponent implements OnInit {
  private admin = inject(AdminService);
  private destroyRef = inject(DestroyRef);
  private cdr = inject(ChangeDetectorRef);

  readonly minga = input.required<Minga>();
  readonly cerrar = output<void>();
  readonly guardada = output<void>();

  /** Estado vigente según el servidor (puede haber cambiado desde que se cargó la lista). */
  estado = '';
  cargando = false;
  guardando = false;
  error = '';
  buscar = '';
  asistencias: AsistenciaMinga[] = [];
  private disponible = false;

  get filtradas() {
    const texto = this.buscar.trim().toLocaleLowerCase('es');
    return this.asistencias.filter((a) => `${a.nombre} ${a.cedula}`.toLocaleLowerCase('es').includes(texto));
  }

  get totalPresentes() {
    return this.asistencias.filter((a) => a.estado === 'PRESENTE').length;
  }

  get totalPendientes() {
    return this.asistencias.filter((a) => a.estado === 'PENDIENTE' || (a.estado === 'JUSTIFICADO' && !a.motivo_justificacion.trim())).length;
  }

  get cerrada() {
    return this.estado === 'REALIZADO' || this.estado === 'CANCELADO';
  }

  ngOnInit(): void {
    this.estado = this.minga().estado;
    this.cargar();
  }

  cargar(): void {
    this.cargando = true;
    this.error = '';
    this.disponible = false;
    this.admin
      .getAsistenciasMinga(this.minga().id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.cargando = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (res) => {
          this.estado = res.estado;
          this.disponible = true;
          this.asistencias = res.data || [];
        },
        error: () => (this.error = 'No se pudieron cargar los comuneros y sus asistencias. Intente nuevamente.')
      });
  }

  /** Pulsar el estado activo lo devuelve a pendiente. */
  setEstado(a: AsistenciaMinga, estado: Exclude<EstadoAsistenciaMinga, 'PENDIENTE'>): void {
    if (this.cerrada || this.guardando) return;
    a.estado = a.estado === estado ? 'PENDIENTE' : estado;
  }

  marcarPresentes(): void {
    if (this.cerrada) return;
    // Respeta las justificaciones previamente registradas.
    this.filtradas.filter((a) => a.estado !== 'JUSTIFICADO').forEach((a) => (a.estado = 'PRESENTE'));
  }

  guardar(): void {
    if (this.cerrada || this.guardando || this.cargando || !this.disponible || !this.asistencias.length) return;
    this.error = '';
    if (this.asistencias.some((a) => a.estado === 'JUSTIFICADO' && !a.motivo_justificacion.trim())) {
      this.error = 'Escriba el motivo de cada ausencia justificada.';
      return;
    }
    const payload = this.asistencias.map((a) => ({
      persona_id: a.persona_id,
      estado: a.estado,
      motivo_justificacion: a.estado === 'JUSTIFICADO' ? a.motivo_justificacion.trim() : null
    }));
    this.guardando = true;
    this.admin
      .registrarAsistenciasMinga(this.minga().id, payload)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.guardando = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: () => this.guardada.emit(),
        error: (err) => (this.error = err.error?.message || 'No se pudo guardar la asistencia. Intente nuevamente.')
      });
  }
}
