import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../../../core/services/admin.service';
import { ActasService } from '../../../../../core/services/actas.service';
import { DialogService } from '../../../../../core/services/dialog.service';
import { DocumentosService } from '../../../../../core/services/documentos.service';
import { NotificationService } from '../../../../../core/services/notification.service';
import { FechaLocalPipe } from '../../../../../shared/pipes/fecha-local.pipe';
import { ModalComponent } from '../../../../../shared/ui/modal.component';
import { SkeletonComponent } from '../../../../../shared/ui/skeleton.component';
import { EmptyStateComponent } from '../../../../../shared/ui/empty-state.component';
import { AsambleaItem, EstadoActa, PuntoAsamblea } from '../asamblea.model';
import { AsambleasService } from '../asambleas.service';

/** Redacción de las actas de una asamblea: una por punto tratado, más temas nuevos de la sesión (F07). */
@Component({
  selector: 'app-asamblea-actas',
  standalone: true,
  imports: [FormsModule, FechaLocalPipe, ModalComponent, SkeletonComponent, EmptyStateComponent],
  templateUrl: './asamblea-actas.component.html'
})
export class AsambleaActasComponent implements OnInit {
  private asambleas = inject(AsambleasService);
  private admin = inject(AdminService);
  private actas = inject(ActasService);
  private documentos = inject(DocumentosService);
  private dialog = inject(DialogService);
  private notify = inject(NotificationService);

  readonly asamblea = input.required<AsambleaItem>();
  readonly cerrar = output<void>();

  readonly cargando = signal(true);
  readonly errorCarga = signal(false);
  readonly guardando = signal(false);
  readonly subiendoPuntoId = signal<number | null>(null);

  puntos: PuntoAsamblea[] = [];
  mostrarNuevoTema = false;
  nuevoTema = { punto_tratar: '', tratado: '', resolucion: '', responsables: '' };

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.errorCarga.set(false);
    this.asambleas.puntos(this.asamblea().id).subscribe({
      next: (puntos) => {
        this.puntos = puntos;
        this.cargando.set(false);
      },
      error: () => {
        this.errorCarga.set(true);
        this.cargando.set(false);
      }
    });
  }

  agregarTemaNuevo(): void {
    const tema = this.nuevoTema.punto_tratar.trim();
    if (!tema) {
      this.dialog.aviso({ tipo: 'WARNING', titulo: 'Campo requerido', mensaje: 'Ingrese el asunto o título del nuevo tema a tratar.' });
      return;
    }
    const orden = this.puntos.length + 1;
    this.puntos.push({
      orden,
      punto_tratar: `${orden}. ${tema}`,
      titulo_acta: `Acta del Punto ${orden}: ${tema}`,
      tratado: this.nuevoTema.tratado.trim(),
      resolucion: this.nuevoTema.resolucion.trim(),
      responsables: this.nuevoTema.responsables.trim(),
      estado_acta: this.nuevoTema.resolucion.trim() ? 'APROBADA' : 'BORRADOR'
    });
    this.nuevoTema = { punto_tratar: '', tratado: '', resolucion: '', responsables: '' };
    this.mostrarNuevoTema = false;
  }

  guardarTodos(): void {
    this.guardando.set(true);
    this.admin.guardarPuntosAsamblea(this.asamblea().id, this.puntos).subscribe({
      next: (res: any) => {
        this.guardando.set(false);
        if (res?.data) this.puntos = res.data.map((p: any) => ({ ...p, acta_firmada_url: p.acta_firmada_url || undefined }));
        this.notify.success('Las actas y puntos de la asamblea se guardaron correctamente.');
      },
      error: (err: any) => {
        this.guardando.set(false);
        this.dialog.aviso({ tipo: 'DANGER', titulo: 'No se pudo guardar', mensaje: err?.error?.message || 'Error al guardar puntos de asamblea.' });
      }
    });
  }

  descargarActaPorPunto(punto: PuntoAsamblea): void {
    this.actas.generarActaPuntoPDF(this.asamblea(), punto);
  }

  descargarActaGeneral(): void {
    this.actas.generarActaPDF(this.asamblea(), this.puntos);
  }

  verDocumento(url?: string): void {
    this.documentos.abrir(url);
  }

  subirActaFirmada(punto: PuntoAsamblea, input: HTMLInputElement): void {
    const archivo = input.files?.[0];
    input.value = '';
    if (!archivo || !punto.id) return;
    const problema = this.documentos.validarArchivo(archivo);
    if (problema) {
      this.dialog.aviso({ tipo: 'WARNING', titulo: 'Archivo no válido', mensaje: problema });
      return;
    }
    this.subiendoPuntoId.set(punto.id);
    this.documentos.subir(this.asamblea().id, 'ACTA', archivo, punto.id).subscribe({
      next: (res) => {
        this.subiendoPuntoId.set(null);
        punto.acta_firmada_url = res.url;
        punto.acta_firmada_nombre = res.nombre_archivo;
        punto.estado_acta = 'FIRMADA';
        this.notify.success(`Acta firmada del punto ${punto.orden} subida.`);
      },
      error: (err: any) => {
        this.subiendoPuntoId.set(null);
        this.dialog.aviso({ tipo: 'DANGER', titulo: 'No se pudo subir el acta', mensaje: err?.error?.message || 'Error al subir el acta firmada.' });
      }
    });
  }

  cambiarEstadoActa(punto: PuntoAsamblea, estado: EstadoActa): void {
    const anterior = punto.estado_acta;
    punto.estado_acta = estado;
    if (!punto.id) return;
    this.admin.cambiarEstadoActaPunto(this.asamblea().id, punto.id, { estado_acta: estado }).subscribe({
      error: (err) => {
        punto.estado_acta = anterior;
        this.notify.warning(err.error?.message || 'No se pudo actualizar el estado del acta.');
      }
    });
  }
}
