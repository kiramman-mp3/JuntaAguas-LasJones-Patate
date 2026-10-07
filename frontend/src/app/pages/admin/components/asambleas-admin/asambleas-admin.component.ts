import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../../core/services/admin.service';
import { ActasService } from '../../../../core/services/actas.service';
import { DialogService } from '../../../../core/services/dialog.service';
import { DocumentosService } from '../../../../core/services/documentos.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { WhatsAppSesionService } from '../../../../core/services/whatsapp-sesion.service';
import { hoyEnEcuador } from '../../../../core/utils/fechas';
import { agruparPorFecha } from '../../../../core/utils/eventos';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state.component';
import { SkeletonComponent } from '../../../../shared/ui/skeleton.component';
import { AsambleaItem, DocumentoFirmado, estadoTexto } from './asamblea.model';
import { AsambleasService } from './asambleas.service';
import { AsambleaCardComponent, SubidaDocumento, TipoDocumentoAsamblea } from './asamblea-card/asamblea-card.component';
import { AsambleaFormComponent } from './asamblea-form/asamblea-form.component';
import { AsambleaAsistenciaComponent } from './asamblea-asistencia/asamblea-asistencia.component';
import { AsambleaActasComponent } from './asamblea-actas/asamblea-actas.component';
import { DocumentoFirmadoComponent } from './documento-firmado/documento-firmado.component';

export type { AsambleaItem, PuntoAsamblea } from './asamblea.model';

type EstadoDestino = 'PROGRAMADO' | 'CONVOCADO' | 'CANCELADO';

/**
 * Listado de asambleas y su flujo (borrador → programada → convocada → realizada).
 * El formulario, la asistencia, las actas y el visor de documentos son componentes propios;
 * aquí solo se coordinan y se aplican las reglas de transición de estado.
 */
@Component({
  selector: 'app-asambleas-admin',
  standalone: true,
  imports: [
    FormsModule,
    EmptyStateComponent,
    SkeletonComponent,
    AsambleaCardComponent,
    AsambleaFormComponent,
    AsambleaAsistenciaComponent,
    AsambleaActasComponent,
    DocumentoFirmadoComponent
  ],
  templateUrl: './asambleas-admin.component.html'
})
export class AsambleasAdminComponent implements OnInit {
  private servicio = inject(AsambleasService);
  private admin = inject(AdminService);
  private actasService = inject(ActasService);
  private documentos = inject(DocumentosService);
  private dialog = inject(DialogService);
  private notify = inject(NotificationService);
  readonly whatsapp = inject(WhatsAppSesionService);

  readonly asambleas = signal<AsambleaItem[]>([]);
  readonly cargando = signal(false);
  readonly error = signal('');
  readonly ocupadaId = signal<number | null>(null);

  readonly busqueda = signal('');
  readonly subtipoFiltro = signal<'TODAS' | 'ORDINARIA' | 'EXTRAORDINARIA'>('TODAS');
  readonly periodo = signal<'TODAS' | 'PROXIMAS' | 'ANTERIORES'>('TODAS');

  // Modales abiertos (cada uno es un componente independiente)
  readonly formularioAbierto = signal(false);
  readonly asistenciaDe = signal<AsambleaItem | null>(null);
  readonly actasDe = signal<AsambleaItem | null>(null);
  readonly documento = signal<DocumentoFirmado | null>(null);

  readonly filtradas = computed(() => {
    const hoy = hoyEnEcuador();
    const q = this.busqueda().toLowerCase().trim();
    const subtipo = this.subtipoFiltro();
    const periodo = this.periodo();
    return this.asambleas().filter(
      (a) =>
        (subtipo === 'TODAS' || a.subtipo_asamblea === subtipo) &&
        !(periodo === 'PROXIMAS' && a.fecha < hoy) &&
        !(periodo === 'ANTERIORES' && a.fecha >= hoy) &&
        (!q || a.titulo.toLowerCase().includes(q) || !!a.lugar?.toLowerCase().includes(q) || !!a.descripcion?.toLowerCase().includes(q))
    );
  });

  /** Próximas (la más cercana primero) y anteriores (la más reciente primero), sin grupos vacíos. */
  readonly secciones = computed(() => agruparPorFecha(this.filtradas(), hoyEnEcuador()));

  readonly hayFiltros = computed(() => !!this.busqueda().trim() || this.subtipoFiltro() !== 'TODAS' || this.periodo() !== 'TODAS');

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set('');
    this.servicio.listar().subscribe({
      next: (lista) => {
        this.asambleas.set(lista);
        this.cargando.set(false);
      },
      error: () => {
        this.cargando.set(false);
        this.error.set('No se pudo cargar la lista de asambleas. Intente nuevamente.');
      }
    });
  }

  limpiarFiltros(): void {
    this.busqueda.set('');
    this.subtipoFiltro.set('TODAS');
    this.periodo.set('TODAS');
  }

  // ============== MODALES ==============

  onCreada(): void {
    this.formularioAbierto.set(false);
    this.notify.success('Asamblea creada con sus puntos del orden del día.');
    this.cargar();
  }

  onAsistenciaGuardada(): void {
    this.asistenciaDe.set(null);
    this.notify.success('Asistencias registradas y sincronizadas.');
    this.cargar();
  }

  verDocumento(asamblea: AsambleaItem, tipo: TipoDocumentoAsamblea): void {
    this.documento.set(
      tipo === 'CONVOCATORIA'
        ? { titulo: 'Convocatoria firmada', url: asamblea.convocatoria_firmada_url || '', nombre: asamblea.convocatoria_firmada_nombre || 'Convocatoria_Firmada.pdf' }
        : { titulo: 'Lista de asistencia firmada', url: asamblea.lista_asistencia_firmada_url || '', nombre: 'Lista_Asistencia_Firmada.pdf' }
    );
  }

  // ============== GESTIÓN DE ESTADOS (C10) ==============

  async cambiarEstado(asamblea: AsambleaItem, nuevoEstado: EstadoDestino): Promise<void> {
    if (nuevoEstado === 'CANCELADO') {
      const confirmado = await this.dialog.confirmar({
        tipo: 'DANGER',
        titulo: '¿Cancelar asamblea?',
        mensaje: `La asamblea "${asamblea.titulo}" quedará archivada como cancelada y no generará multas a los comuneros.`,
        textoConfirmar: 'Sí, cancelar asamblea'
      });
      if (!confirmado) return;
    }
    this.ocupadaId.set(asamblea.id);
    this.admin.cambiarEstadoAsamblea(asamblea.id, nuevoEstado).subscribe({
      next: () => {
        this.ocupadaId.set(null);
        this.actualizar(asamblea.id, { estado: nuevoEstado });
        this.notify.success(`Estado actualizado a: ${estadoTexto(nuevoEstado)}.`);
      },
      error: (err: any) => {
        this.ocupadaId.set(null);
        this.dialog.aviso({ tipo: 'DANGER', titulo: 'No se pudo cambiar el estado', mensaje: err?.error?.message || 'Error al actualizar el estado de la asamblea.' });
      }
    });
  }

  async finalizarAsamblea(asamblea: AsambleaItem): Promise<void> {
    if (asamblea.estado !== 'CONVOCADO') {
      this.dialog.aviso({ tipo: 'WARNING', titulo: 'Acción no permitida', mensaje: 'Solo se puede finalizar una asamblea convocada.' });
      return;
    }
    if (asamblea.fecha > hoyEnEcuador()) {
      this.dialog.aviso({
        tipo: 'WARNING',
        titulo: 'La sesión aún no ocurre',
        mensaje: `La asamblea "${asamblea.titulo}" está programada para el ${asamblea.fecha}. Solo puede darse por realizada desde esa fecha. Si se suspendió, use "Cancelar".`
      });
      return;
    }
    if (!asamblea.asistentes) {
      this.dialog.aviso({
        tipo: 'WARNING',
        titulo: 'Asistencia requerida',
        mensaje: 'Registre y guarde el pase de lista antes de finalizar (constan 0 asistentes). Si no hubo cuórum, use "Cancelar".'
      });
      return;
    }
    const multa = asamblea.genera_multa_ausencia
      ? ` Se emitirán multas de $${asamblea.valor_multa.toFixed(2)} a los ausentes sin justificación.`
      : '';
    const confirmado = await this.dialog.confirmar({
      tipo: 'CONFIRM',
      titulo: 'Finalizar asamblea',
      mensaje: `Se cerrará la asistencia con ${asamblea.asistentes} comuneros presentes.${multa} Esta acción es irreversible.`,
      textoConfirmar: 'Dar por realizada'
    });
    if (!confirmado) return;

    this.ocupadaId.set(asamblea.id);
    this.admin.finalizarAsamblea(asamblea.id).subscribe({
      next: (res: any) => {
        this.ocupadaId.set(null);
        this.actualizar(asamblea.id, { estado: 'REALIZADO' });
        this.notify.success(`Asamblea finalizada. Se generaron ${res?.multasGeneradas || 0} multas automáticas.`);
      },
      error: (err: any) => {
        this.ocupadaId.set(null);
        this.dialog.aviso({ tipo: 'DANGER', titulo: 'No se pudo finalizar', mensaje: err?.error?.message || 'Error al finalizar la asamblea.' });
      }
    });
  }

  enviarConvocatoriaWhatsApp(asamblea: AsambleaItem): void {
    const msg = encodeURIComponent(
      `📢 *CONVOCATORIA OFICIAL - JUNTA DE RIEGO LA JONES*\n\n` +
        `Se convoca a todos los comuneros a la *ASAMBLEA GENERAL ${asamblea.subtipo_asamblea || 'ORDINARIA'}*:\n` +
        `🗓 *Fecha:* ${asamblea.fecha}\n` +
        `🕐 *Hora:* ${asamblea.hora_inicio} hs\n` +
        `📍 *Lugar:* ${asamblea.lugar || 'Casa Comunal Junta La Jones'}\n` +
        (asamblea.genera_multa_ausencia ? `⚠️ *Multa por inasistencia:* $${asamblea.valor_multa.toFixed(2)}\n\n` : '\n') +
        `Agradecemos su puntual y comprometida asistencia.`
    );
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  }

  // ============== DOCUMENTOS: CONVOCATORIA Y PADRÓN ==============

  descargarConvocatoriaPdf(asamblea: AsambleaItem): void {
    this.actasService.generarConvocatoriaPDF(asamblea);
  }

  descargarPadronAsistencia(asamblea: AsambleaItem): void {
    this.documentos.abrirListaAsistencia(asamblea.id);
  }

  subirDocumentoFirmado(asamblea: AsambleaItem, { tipo, input }: SubidaDocumento): void {
    const archivo = input.files?.[0];
    input.value = '';
    if (!archivo) return;
    const problema = this.documentos.validarArchivo(archivo);
    if (problema) {
      this.dialog.aviso({ tipo: 'WARNING', titulo: 'Archivo no válido', mensaje: problema });
      return;
    }
    this.ocupadaId.set(asamblea.id);
    this.documentos.subir(asamblea.id, tipo === 'CONVOCATORIA' ? 'CONVOCATORIA' : 'OTRO', archivo).subscribe({
      next: (res) => {
        this.ocupadaId.set(null);
        this.actualizar(
          asamblea.id,
          tipo === 'CONVOCATORIA'
            ? { convocatoria_firmada_url: res.url, convocatoria_firmada_nombre: res.nombre_archivo }
            : { lista_asistencia_firmada_url: res.url }
        );
        this.notify.success('Documento firmado subido y registrado.');
      },
      error: (err: any) => {
        this.ocupadaId.set(null);
        this.dialog.aviso({ tipo: 'DANGER', titulo: 'No se pudo subir el documento', mensaje: err?.error?.message || 'Error al subir el documento firmado.' });
      }
    });
  }

  /** Aplica un cambio a una asamblea de la lista sin volver a pedirla al servidor. */
  private actualizar(id: number, cambios: Partial<AsambleaItem>): void {
    this.asambleas.update((lista) => lista.map((a) => (a.id === id ? { ...a, ...cambios } : a)));
  }
}
