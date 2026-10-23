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
import { AsambleaItem, PuntoAsamblea } from '../asamblea.model';
import { AsambleasService } from '../asambleas.service';

/** Redacción del acta general de una asamblea: los puntos tratados y los temas nuevos de la sesión (F07). */
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
  readonly subiendoActa = signal(false);
  readonly actaFirmadaUrl = signal<string | undefined>(undefined);

  puntos: PuntoAsamblea[] = [];
  mostrarNuevoTema = false;
  nuevoTema = { punto_tratar: '', tratado: '', resolucion: '' };

  ngOnInit(): void {
    this.actaFirmadaUrl.set(this.asamblea().acta_firmada_url);
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
      tratado: this.nuevoTema.tratado.trim(),
      resolucion: this.nuevoTema.resolucion.trim()
    });
    this.nuevoTema = { punto_tratar: '', tratado: '', resolucion: '' };
    this.mostrarNuevoTema = false;
  }

  guardarTodos(): void {
    this.guardando.set(true);
    this.admin.guardarPuntosAsamblea(this.asamblea().id, this.puntos).subscribe({
      next: (res) => {
        this.guardando.set(false);
        if (res?.data) this.puntos = res.data as PuntoAsamblea[];
        this.notify.success('El acta de la asamblea se guardó correctamente.');
      },
      error: (err) => {
        this.guardando.set(false);
        this.dialog.aviso({ tipo: 'DANGER', titulo: 'No se pudo guardar', mensaje: err?.error?.message || 'Error al guardar puntos de asamblea.' });
      }
    });
  }

  descargarActaGeneral(): void {
    this.actas.generarActaPDF(this.asamblea(), this.puntos);
  }

  verDocumento(url?: string): void {
    this.documentos.abrir(url);
  }

  subirActaFirmada(input: HTMLInputElement): void {
    const archivo = input.files?.[0];
    input.value = '';
    if (!archivo) return;
    const problema = this.documentos.validarArchivo(archivo);
    if (problema) {
      this.dialog.aviso({ tipo: 'WARNING', titulo: 'Archivo no válido', mensaje: problema });
      return;
    }
    this.subiendoActa.set(true);
    this.documentos.subir(this.asamblea().id, 'ACTA', archivo).subscribe({
      next: (res) => {
        this.subiendoActa.set(false);
        this.actaFirmadaUrl.set(res.url);
        this.notify.success('Acta general firmada subida.');
      },
      error: (err) => {
        this.subiendoActa.set(false);
        this.dialog.aviso({ tipo: 'DANGER', titulo: 'No se pudo subir el acta', mensaje: err?.error?.message || 'Error al subir el acta firmada.' });
      }
    });
  }
}
