import { ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, firstValueFrom } from 'rxjs';
import { AdminService } from '../../../../core/services/admin.service';
import { ConsultaService } from '../../../../core/services/consulta.service';
import { DialogService } from '../../../../core/services/dialog.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { WhatsAppSesionService } from '../../../../core/services/whatsapp-sesion.service';
import { hoyEnEcuador } from '../../../../core/utils/fechas';
import { agruparPorFecha } from '../../../../core/utils/eventos';
import { MenuComponent } from '../../../../shared/ui/menu.component';
import { FechaLocalPipe } from '../../../../shared/pipes/fecha-local.pipe';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state.component';
import { SkeletonComponent } from '../../../../shared/ui/skeleton.component';
import { Minga } from './minga.model';
import { MingaFormComponent } from './minga-form/minga-form.component';
import { MingaAsistenciaComponent } from './minga-asistencia/minga-asistencia.component';

/**
 * Listado de mingas y su flujo (borrador → programada → convocada → realizada).
 * El registro y la asistencia son componentes propios; aquí se coordinan las convocatorias,
 * los cambios de estado y la lista firmada.
 */
@Component({
  selector: 'app-mingas-admin',
  standalone: true,
  imports: [CurrencyPipe, FechaLocalPipe, FormsModule, EmptyStateComponent, SkeletonComponent, MenuComponent, MingaFormComponent, MingaAsistenciaComponent],
  templateUrl: './mingas-admin.component.html'
})
export class MingasAdminComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly admin = inject(AdminService);
  private readonly consulta = inject(ConsultaService);
  private readonly dialog = inject(DialogService);
  private readonly notify = inject(NotificationService);
  private readonly cdr = inject(ChangeDetectorRef);
  readonly whatsapp = inject(WhatsAppSesionService);

  mingas: Minga[] = [];
  cargando = false;
  /** Error al cargar la lista (las fallas de acciones se notifican con toasts). */
  error = '';
  busqueda = '';
  periodo: 'TODAS' | 'PROXIMAS' | 'ANTERIORES' = 'TODAS';
  formularioAbierto = false;
  seleccionada: Minga | null = null;
  actualizandoId: number | null = null;
  subiendoId: number | null = null;
  descargandoId: number | null = null;

  ngOnInit() {
    this.cargar();
  }

  get mingasFiltradas() {
    const texto = this.busqueda.trim().toLocaleLowerCase('es');
    const hoy = hoyEnEcuador();
    return this.mingas.filter(
      (m) =>
        (!texto || `${m.titulo} ${m.lugar}`.toLocaleLowerCase('es').includes(texto)) &&
        (this.periodo === 'TODAS' || (this.periodo === 'PROXIMAS' ? m.fecha >= hoy : m.fecha < hoy))
    );
  }

  /** Próximas (la más cercana primero) y anteriores (la más reciente primero). */
  get secciones() {
    return agruparPorFecha(this.mingasFiltradas, hoyEnEcuador());
  }

  get hayFiltros() {
    return !!this.busqueda.trim() || this.periodo !== 'TODAS';
  }

  get ocupado() {
    return this.actualizandoId !== null || this.whatsapp.enviandoEventoId() !== null;
  }

  limpiarFiltros() {
    this.busqueda = '';
    this.periodo = 'TODAS';
  }

  estadoTexto(estado: string) {
    const etiquetas: Record<string, string> = {
      BORRADOR: 'Borrador',
      PROGRAMADO: 'Programada',
      CONVOCADO: 'Convocada',
      REALIZADO: 'Realizada',
      CANCELADO: 'Cancelada'
    };
    return etiquetas[estado] || 'Sin estado';
  }

  estadoBadge(estado: string) {
    const tonos: Record<string, string> = {
      PROGRAMADO: 'badge--info',
      CONVOCADO: 'badge--warning',
      REALIZADO: 'badge--success',
      CANCELADO: 'badge--danger'
    };
    return tonos[estado] || 'badge--neutral';
  }

  porcentaje(m: Minga) {
    return m.totalComuneros ? Math.round((m.asistentes / m.totalComuneros) * 100) : 0;
  }

  cargar() {
    this.cargando = true;
    this.error = '';
    this.admin
      .getEventos('MINGA')
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.cargando = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (res) => {
          this.mingas = (res.data || [])
            .filter((m) => m.tipo === 'MINGA')
            .map((evento) => evento as unknown as Minga)
            .map((m) => ({
              ...m,
              fecha: String(m.fecha || '').split('T')[0],
              asistentes: Number(m.asistentes) || 0,
              totalComuneros: Number(m.totalComuneros) || 0,
              valor_multa: Number(m.valor_multa) || 0,
              genera_multa_ausencia: Boolean(m.genera_multa_ausencia)
            }));
        },
        error: (err) => (this.error = err.error?.message || 'No se pudieron cargar las mingas. Intente nuevamente.')
      });
  }

  onCreada() {
    this.formularioAbierto = false;
    this.notify.success('Minga registrada. Puede enviar la convocatoria por WhatsApp desde sus acciones.');
    this.cargar();
  }

  onAsistenciaGuardada() {
    this.seleccionada = null;
    this.notify.success('Asistencia de la minga guardada.');
    this.cargar();
  }

  abrirAsistencia(minga: Minga) {
    if (minga.estado !== 'CANCELADO') this.seleccionada = minga;
  }

  async cambiarEstado(minga: Minga, estado: 'PROGRAMADO' | 'CONVOCADO' | 'CANCELADO') {
    if (this.ocupado) return;
    if (estado === 'CANCELADO') {
      const confirmado = await this.dialog.confirmar({
        tipo: 'DANGER',
        titulo: 'Cancelar minga',
        mensaje: `¿Cancelar la minga "${minga.titulo}"? Su asistencia quedará cerrada y no se generarán multas.`,
        textoConfirmar: 'Cancelar minga'
      });
      if (!confirmado) return;
    }
    this.actualizandoId = minga.id;
    this.admin
      .cambiarEstadoMinga(minga.id, estado)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.actualizandoId = null;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (res) => {
          minga.estado = res.estado;
          this.notify.success(res.message);
          this.cargar();
        },
        error: (err) => this.notify.error(err.error?.message || 'No se pudo actualizar la minga.')
      });
  }

  async finalizarMinga(minga: Minga) {
    if (this.ocupado || ['REALIZADO', 'CANCELADO'].includes(minga.estado)) return;
    this.actualizandoId = minga.id;
    try {
      const r = (await firstValueFrom(this.admin.getAsistenciasMinga(minga.id))).resumen;
      if (!r.total || r.pendientes) {
        this.notify.warning(`Complete y guarde la asistencia antes de finalizar. Pendientes: ${r.pendientes}.`);
        return;
      }
      const multa = minga.genera_multa_ausencia
        ? ` Se registrarán multas únicamente para las ${r.ausentes} ausencias.`
        : ' No se generarán multas.';
      const confirmado = await this.dialog.confirmar({
        tipo: 'CONFIRM',
        titulo: 'Finalizar minga',
        mensaje: `Asistencia guardada: ${r.presentes} presentes, ${r.ausentes} ausentes y ${r.justificados} justificados.${multa} La asistencia quedará cerrada.`,
        textoConfirmar: 'Finalizar minga'
      });
      if (!confirmado) return;
      const res = await firstValueFrom(this.admin.finalizarMinga(minga.id));
      minga.estado = res.estado;
      this.notify.success(res.message);
      this.cargar();
    } catch (err) {
      this.notify.error((err as any)?.error?.message || 'No se pudo finalizar la minga.');
    } finally {
      this.actualizandoId = null;
      this.cdr.markForCheck();
    }
  }

  /** Publica la convocatoria en el grupo de WhatsApp; el backend la deja CONVOCADA. */
  async enviarConvocatoria(minga: Minga) {
    if (this.ocupado || minga.estado === 'CANCELADO' || minga.estado === 'REALIZADO') return;
    const resultado = await this.whatsapp.convocar(minga);
    if (resultado) minga.estado = resultado.estado;
    this.cdr.markForCheck();
  }

  descargarLista(minga: Minga) {
    if (this.descargandoId !== null) return;
    this.descargandoId = minga.id;
    this.consulta
      .descargarListaAsistencia(minga.id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.descargandoId = null;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          const enlace = document.createElement('a');
          enlace.href = url;
          enlace.download = `Asistencia_Minga_${minga.id}.pdf`;
          enlace.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        },
        error: () => this.notify.error('No se pudo descargar la lista de asistencia.')
      });
  }

  subirLista(minga: Minga, input: HTMLInputElement) {
    const archivo = input.files?.[0];
    input.value = '';
    if (!archivo || this.subiendoId !== null) return;
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(archivo.type) || archivo.size > 10 * 1024 * 1024 || archivo.size === 0) {
      this.notify.warning('Seleccione un PDF, JPG o PNG válido de hasta 10 MB.');
      return;
    }
    this.subiendoId = minga.id;
    this.consulta
      .subirDocumentoEvento(minga.id, 'OTRO', archivo)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.subiendoId = null;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: () => {
          this.notify.success('Lista firmada guardada.');
          this.cargar();
        },
        error: (err) => this.notify.error(err.error?.message || 'No se pudo subir la lista firmada.')
      });
  }

  verLista(minga: Minga) {
    this.consulta.abrirDocumento(minga.lista_asistencia_firmada_url);
  }
}
