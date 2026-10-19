import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../../../core/services/admin.service';
import { DialogService } from '../../../../../core/services/dialog.service';
import { FechaLocalPipe } from '../../../../../shared/pipes/fecha-local.pipe';
import { ModalComponent } from '../../../../../shared/ui/modal.component';
import { SkeletonComponent } from '../../../../../shared/ui/skeleton.component';
import { EmptyStateComponent } from '../../../../../shared/ui/empty-state.component';
import { AsambleaItem, AsistentePadron, EstadoAsistencia, resumirAsistencia } from '../asamblea.model';
import { AsambleasService } from '../asambleas.service';

type FiltroEstado = 'TODOS' | EstadoAsistencia;

/** Pase de lista digital de una asamblea: marca presentes, ausentes y justificados. */
@Component({
  selector: 'app-asamblea-asistencia',
  standalone: true,
  imports: [FormsModule, FechaLocalPipe, ModalComponent, SkeletonComponent, EmptyStateComponent],
  templateUrl: './asamblea-asistencia.component.html'
})
export class AsambleaAsistenciaComponent implements OnInit {
  private asambleas = inject(AsambleasService);
  private admin = inject(AdminService);
  private dialog = inject(DialogService);

  readonly asamblea = input.required<AsambleaItem>();
  readonly cerrar = output<void>();
  readonly guardada = output<void>();

  readonly cargando = signal(true);
  readonly errorCarga = signal(false);
  readonly guardando = signal(false);
  readonly personas = signal<AsistentePadron[]>([]);
  readonly filtro = signal('');
  readonly estadoFiltro = signal<FiltroEstado>('TODOS');

  readonly resumen = computed(() => resumirAsistencia(this.personas()));
  readonly soloLectura = computed(() => this.asamblea().estado === 'CANCELADO');
  readonly subiendoArchivo = signal<number | null>(null);

  readonly filtradas = computed(() => {
    const q = this.filtro().toLowerCase().trim();
    const estado = this.estadoFiltro();
    return this.personas().filter(
      (p) =>
        (estado === 'TODOS' || p.estado === estado) &&
        (!q || p.nombre.toLowerCase().includes(q) || p.cedula.includes(q) || !!p.sector?.toLowerCase().includes(q))
    );
  });

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.errorCarga.set(false);
    // El servidor devuelve el padrón completo con el estado ya guardado de cada comunero.
    this.asambleas.padron(this.asamblea().id).subscribe({
      next: (padron) => {
        this.personas.set(padron);
        this.cargando.set(false);
      },
      error: () => {
        this.errorCarga.set(true);
        this.cargando.set(false);
      }
    });
  }

  marcarTodos(estado: 'PRESENTE' | 'AUSENTE'): void {
    this.personas.update((lista) => lista.map((p) => ({ ...p, estado, motivo_justificacion: '', archivo_justificacion_url: null, archivo_justificacion_nombre: null })));
  }

  setEstado(persona: AsistentePadron, estado: 'PRESENTE' | 'AUSENTE' | 'JUSTIFICADO'): void {
    this.personas.update((lista) =>
      lista.map((p) =>
        p === persona
          ? {
              ...p,
              estado,
              motivo_justificacion: estado === 'JUSTIFICADO' ? p.motivo_justificacion : '',
              archivo_justificacion_url: estado === 'JUSTIFICADO' ? p.archivo_justificacion_url : null,
              archivo_justificacion_nombre: estado === 'JUSTIFICADO' ? p.archivo_justificacion_nombre : null
            }
          : p
      )
    );
  }

  setMotivo(persona: AsistentePadron, motivo: string): void {
    persona.motivo_justificacion = motivo;
  }

  adjuntarArchivo(persona: AsistentePadron, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      this.dialog.aviso({
        tipo: 'WARNING',
        titulo: 'Archivo demasiado pesado',
        mensaje: 'El archivo adjunto no puede superar los 10 MB.'
      });
      input.value = '';
      return;
    }

    this.subiendoArchivo.set(persona.persona_id);
    this.admin.subirJustificanteAsistencia(this.asamblea().id, persona.persona_id, file, persona.motivo_justificacion).subscribe({
      next: (res: any) => {
        this.subiendoArchivo.set(null);
        persona.archivo_justificacion_url = res.url;
        persona.archivo_justificacion_nombre = res.nombre;
        if (!persona.motivo_justificacion.trim()) {
          persona.motivo_justificacion = 'Inasistencia justificada con documento';
        }
        input.value = '';
      },
      error: (err: any) => {
        this.subiendoArchivo.set(null);
        input.value = '';
        this.dialog.aviso({
          tipo: 'DANGER',
          titulo: 'Error al subir archivo',
          mensaje: err?.error?.message || 'No se pudo subir el archivo de justificación.'
        });
      }
    });
  }

  descargarArchivo(persona: AsistentePadron): void {
    this.admin.descargarJustificanteAsistencia(this.asamblea().id, persona.persona_id).subscribe({
      next: (blob: Blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const ext = blob.type === 'application/pdf' ? 'pdf' : blob.type === 'image/png' ? 'png' : 'jpg';
        a.download = persona.archivo_justificacion_nombre || `Justificante_${persona.cedula}.${ext}`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      },
      error: () => {
        this.dialog.aviso({
          tipo: 'DANGER',
          titulo: 'Error de descarga',
          mensaje: 'No se pudo descargar el archivo de justificación.'
        });
      }
    });
  }

  async eliminarArchivo(persona: AsistentePadron): Promise<void> {
    const seguro = await this.dialog.confirmar({
      tipo: 'DANGER',
      titulo: '¿Quitar archivo adjunto?',
      mensaje: `¿Desea eliminar el archivo "${persona.archivo_justificacion_nombre || 'justificativo'}"? La justificación escrita se mantendrá.`,
      textoConfirmar: 'Quitar archivo',
      textoCancelar: 'Cancelar'
    });
    if (!seguro) return;

    this.admin.eliminarJustificanteAsistencia(this.asamblea().id, persona.persona_id).subscribe({
      next: () => {
        persona.archivo_justificacion_url = null;
        persona.archivo_justificacion_nombre = null;
      },
      error: (err: any) => {
        this.dialog.aviso({
          tipo: 'DANGER',
          titulo: 'Error al quitar archivo',
          mensaje: err?.error?.message || 'No se pudo eliminar el archivo adjunto.'
        });
      }
    });
  }

  guardar(): void {
    const personas = this.personas();
    const sinMotivo = personas.filter((p) => p.estado === 'JUSTIFICADO' && !p.motivo_justificacion.trim()).length;
    if (sinMotivo > 0) {
      this.dialog.aviso({
        tipo: 'WARNING',
        titulo: 'Justificación requerida',
        mensaje: `Hay ${sinMotivo} comunero(s) marcados como justificados sin motivo escrito. Ingrese el justificativo antes de guardar.`
      });
      return;
    }

    this.guardando.set(true);
    const payload = personas.map((p) => ({
      persona_id: p.persona_id,
      estado: p.estado,
      motivo_justificacion: p.estado === 'JUSTIFICADO' ? p.motivo_justificacion.trim() : null,
      archivo_justificacion_url: p.estado === 'JUSTIFICADO' ? p.archivo_justificacion_url : null,
      archivo_justificacion_nombre: p.estado === 'JUSTIFICADO' ? p.archivo_justificacion_nombre : null
    }));
    this.admin.registrarAsistencias(this.asamblea().id, payload).subscribe({
      next: () => {
        this.guardando.set(false);
        this.guardada.emit();
      },
      error: (err) => {
        this.guardando.set(false);
        this.dialog.aviso({ tipo: 'DANGER', titulo: 'No se pudo guardar', mensaje: err?.error?.message || 'Error al guardar asistencias.' });
      }
    });
  }
}
