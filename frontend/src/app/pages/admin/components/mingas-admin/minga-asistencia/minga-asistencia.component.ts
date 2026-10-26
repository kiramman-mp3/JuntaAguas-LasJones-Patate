import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  inject,
  input,
  output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { AdminService } from '../../../../../core/services/admin.service';
import { DialogService } from '../../../../../core/services/dialog.service';
import { FechaLocalPipe } from '../../../../../shared/pipes/fecha-local.pipe';
import { ModalComponent } from '../../../../../shared/ui/modal.component';
import { SkeletonComponent } from '../../../../../shared/ui/skeleton.component';
import { EmptyStateComponent } from '../../../../../shared/ui/empty-state.component';
import { AsistenciaMinga, EstadoAsistenciaMinga, Minga } from '../minga.model';

/** Registro de asistencia de una minga. Los usuarios sin marcar quedan pendientes. */
@Component({
  selector: 'app-minga-asistencia',
  standalone: true,
  imports: [FormsModule, FechaLocalPipe, ModalComponent, SkeletonComponent, EmptyStateComponent],
  templateUrl: './minga-asistencia.component.html',
})
export class MingaAsistenciaComponent implements OnInit {
  private admin = inject(AdminService);
  private dialog = inject(DialogService);
  private destroyRef = inject(DestroyRef);
  private cdr = inject(ChangeDetectorRef);

  readonly minga = input.required<Minga>();
  readonly cerrar = output<void>();
  readonly guardada = output<void>();

  /** Estado vigente según el servidor (puede haber cambiado desde que se cargó la lista). */
  estado = '';
  cargando = false;
  guardando = false;
  subiendoPersonaId: number | null = null;
  error = '';
  buscar = '';
  asistencias: AsistenciaMinga[] = [];
  private disponible = false;

  get filtradas() {
    const texto = this.buscar.trim().toLocaleLowerCase('es');
    return this.asistencias.filter((a) =>
      `${a.nombre} ${a.cedula}`.toLocaleLowerCase('es').includes(texto),
    );
  }

  get totalPresentes() {
    return this.asistencias.filter((a) => a.estado === 'PRESENTE').length;
  }

  get totalPendientes() {
    return this.asistencias.filter(
      (a) =>
        a.estado === 'PENDIENTE' || (a.estado === 'JUSTIFICADO' && !a.motivo_justificacion.trim()),
    ).length;
  }

  get cerrada() {
    return this.estado === 'CANCELADO';
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
        }),
      )
      .subscribe({
        next: (res) => {
          this.estado = res.estado;
          this.disponible = true;
          this.asistencias = res.data || [];
        },
        error: () =>
          (this.error =
            'No se pudieron cargar los usuarios y sus asistencias. Intente nuevamente.'),
      });
  }

  /** Pulsar el estado activo lo devuelve a pendiente. */
  setEstado(a: AsistenciaMinga, estado: Exclude<EstadoAsistenciaMinga, 'PENDIENTE'>): void {
    if (this.cerrada || this.guardando) return;
    a.estado = a.estado === estado ? 'PENDIENTE' : estado;
    if (a.estado !== 'JUSTIFICADO') {
      a.motivo_justificacion = '';
      a.archivo_justificacion_url = null;
      a.archivo_justificacion_nombre = null;
    }
  }

  marcarPresentes(): void {
    if (this.cerrada) return;
    // Respeta las justificaciones previamente registradas.
    this.filtradas
      .filter((a) => a.estado !== 'JUSTIFICADO')
      .forEach((a) => (a.estado = 'PRESENTE'));
  }

  adjuntarArchivo(a: AsistenciaMinga, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      this.dialog.aviso({
        tipo: 'WARNING',
        titulo: 'Archivo demasiado pesado',
        mensaje: 'El archivo adjunto no puede superar los 10 MB.',
      });
      input.value = '';
      return;
    }

    this.subiendoPersonaId = a.persona_id;
    this.admin
      .subirJustificanteAsistenciaMinga(this.minga().id, a.persona_id, file, a.motivo_justificacion)
      .subscribe({
        next: (res) => {
          this.subiendoPersonaId = null;
          a.archivo_justificacion_url = res.url;
          a.archivo_justificacion_nombre = res.nombre;
          if (!a.motivo_justificacion?.trim()) {
            a.motivo_justificacion = 'Inasistencia justificada con documento';
          }
          input.value = '';
          this.cdr.markForCheck();
        },
        error: (err: HttpErrorResponse) => {
          this.subiendoPersonaId = null;
          input.value = '';
          this.cdr.markForCheck();
          this.dialog.aviso({
            tipo: 'DANGER',
            titulo: 'Error al subir archivo',
            mensaje: err?.error?.message || 'No se pudo subir el archivo de justificación.',
          });
        },
      });
  }

  descargarArchivo(a: AsistenciaMinga): void {
    this.admin.descargarJustificanteAsistenciaMinga(this.minga().id, a.persona_id).subscribe({
      next: (blob: Blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const ext =
          blob.type === 'application/pdf' ? 'pdf' : blob.type === 'image/png' ? 'png' : 'jpg';
        link.download = a.archivo_justificacion_nombre || `Justificante_${a.cedula}.${ext}`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      },
      error: () => {
        this.dialog.aviso({
          tipo: 'DANGER',
          titulo: 'Error de descarga',
          mensaje: 'No se pudo descargar el archivo de justificación.',
        });
      },
    });
  }

  async eliminarArchivo(a: AsistenciaMinga): Promise<void> {
    const seguro = await this.dialog.confirmar({
      tipo: 'DANGER',
      titulo: '¿Quitar archivo adjunto?',
      mensaje: `¿Desea eliminar el archivo "${a.archivo_justificacion_nombre || 'justificativo'}"? La justificación escrita se mantendrá.`,
      textoConfirmar: 'Quitar archivo',
      textoCancelar: 'Cancelar',
    });
    if (!seguro) return;

    this.admin.eliminarJustificanteAsistenciaMinga(this.minga().id, a.persona_id).subscribe({
      next: () => {
        a.archivo_justificacion_url = null;
        a.archivo_justificacion_nombre = null;
        this.cdr.markForCheck();
      },
      error: (err: HttpErrorResponse) => {
        this.dialog.aviso({
          tipo: 'DANGER',
          titulo: 'Error al quitar archivo',
          mensaje: err?.error?.message || 'No se pudo eliminar el archivo adjunto.',
        });
      },
    });
  }

  guardar(): void {
    if (
      this.cerrada ||
      this.guardando ||
      this.cargando ||
      !this.disponible ||
      !this.asistencias.length
    )
      return;
    this.error = '';
    if (
      this.asistencias.some((a) => a.estado === 'JUSTIFICADO' && !a.motivo_justificacion.trim())
    ) {
      this.error = 'Escriba el motivo de cada ausencia justificada.';
      return;
    }
    const payload = this.asistencias.map((a) => ({
      persona_id: a.persona_id,
      estado: a.estado,
      motivo_justificacion: a.estado === 'JUSTIFICADO' ? a.motivo_justificacion.trim() : null,
      archivo_justificacion_url:
        a.estado === 'JUSTIFICADO' ? (a.archivo_justificacion_url ?? null) : null,
      archivo_justificacion_nombre:
        a.estado === 'JUSTIFICADO' ? (a.archivo_justificacion_nombre ?? null) : null,
    }));
    this.guardando = true;
    this.admin
      .registrarAsistenciasMinga(this.minga().id, payload)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.guardando = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: () => this.guardada.emit(),
        error: (err) =>
          (this.error =
            err.error?.message || 'No se pudo guardar la asistencia. Intente nuevamente.'),
      });
  }
}
