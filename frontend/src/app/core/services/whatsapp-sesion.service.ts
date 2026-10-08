import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AdminService } from './admin.service';
import { DialogService } from './dialog.service';
import { NotificationService } from './notification.service';
import { ConvocatoriaWhatsApp, EstadoWhatsApp, GrupoWhatsApp } from '../models/api-payloads';

/** Estados en los que la conexión cambia sola y conviene volver a consultarla. */
const EN_CURSO = ['INICIANDO', 'ESPERANDO_QR'];
const INTERVALO_SONDEO_MS = 2000;

/** Cuerpo de error de la API ({ message, codigo }) dentro de un HttpErrorResponse. */
const cuerpoError = (err: unknown) => (err as { error?: { message?: string; codigo?: string } } | null)?.error;
const mensajeDe = (err: unknown, respaldo: string): string => cuerpoError(err)?.message || respaldo;

/**
 * WhatsApp de la Junta: estado de la conexión, grupo donde se publican las convocatorias
 * y envío de la convocatoria de una asamblea o minga. Cualquier vista del panel puede abrir
 * el mismo panel de conexión.
 */
@Injectable({ providedIn: 'root' })
export class WhatsAppSesionService {
  private admin = inject(AdminService);
  private dialog = inject(DialogService);
  private notify = inject(NotificationService);

  readonly visible = signal(false);
  readonly estado = signal<EstadoWhatsApp | null>(null);
  readonly cargando = signal(false);
  readonly grupos = signal<GrupoWhatsApp[]>([]);
  readonly cargandoGrupos = signal(false);
  readonly guardandoGrupo = signal(false);
  /** Evento cuya convocatoria se está publicando (incluye la confirmación), o null. */
  readonly enviandoEventoId = signal<number | null>(null);

  private sondeo: ReturnType<typeof setInterval> | null = null;

  abrir(): void {
    this.visible.set(true);
    this.consultar();
    this.detenerSondeo();
    // Consultar el estado no inicia WhatsApp: solo refleja el avance de una conexión en curso.
    this.sondeo = setInterval(() => {
      if (EN_CURSO.includes(this.estado()?.estado ?? '')) this.consultar(true);
    }, INTERVALO_SONDEO_MS);
  }

  cerrar(): void {
    this.visible.set(false);
    this.detenerSondeo();
  }

  consultar(silencioso = false): void {
    if (!silencioso) this.cargando.set(true);
    this.admin.getWhatsAppEstado().subscribe({
      next: (res) => this.aplicarEstado(res.data),
      error: () => this.cargando.set(false)
    });
  }

  /** Inicia WhatsApp Web; si el teléfono no está vinculado aparecerá el código QR. */
  conectar(): void {
    this.cargando.set(true);
    this.admin.iniciarWhatsApp().subscribe({
      next: (res) => this.aplicarEstado(res.data),
      error: (err) => {
        this.cargando.set(false);
        this.notify.error(mensajeDe(err, 'No se pudo iniciar WhatsApp.'));
      }
    });
  }

  async cerrarSesion(): Promise<void> {
    const confirmado = await this.dialog.confirmar({
      tipo: 'DANGER',
      titulo: 'Desvincular WhatsApp',
      mensaje: '¿Desvincular el teléfono de la Junta? Para volver a enviar convocatorias habrá que escanear un código QR nuevo.',
      textoConfirmar: 'Desvincular'
    });
    if (!confirmado) return;
    this.cargando.set(true);
    this.admin.cerrarSesionWhatsApp().subscribe({
      next: (res) => {
        this.grupos.set([]);
        this.aplicarEstado(res.data);
      },
      error: (err) => {
        this.cargando.set(false);
        this.notify.error(mensajeDe(err, 'No se pudo cerrar la sesión de WhatsApp.'));
      }
    });
  }

  cargarGrupos(): void {
    this.cargandoGrupos.set(true);
    this.admin.getGruposWhatsApp().subscribe({
      next: (res) => {
        this.grupos.set(res.data);
        this.cargandoGrupos.set(false);
      },
      error: (err) => {
        this.cargandoGrupos.set(false);
        this.notify.error(mensajeDe(err, 'No se pudieron cargar los grupos de WhatsApp.'));
      }
    });
  }

  guardarGrupo(grupoId: string): void {
    if (!grupoId || this.guardandoGrupo()) return;
    this.guardandoGrupo.set(true);
    this.admin.guardarGrupoWhatsApp(grupoId).subscribe({
      next: (res) => {
        this.guardandoGrupo.set(false);
        const actual = this.estado();
        if (actual) this.estado.set({ ...actual, grupo: res.data });
        this.notify.success(res.message || 'Grupo de convocatorias guardado.');
      },
      error: (err) => {
        this.guardandoGrupo.set(false);
        this.notify.error(mensajeDe(err, 'No se pudo guardar el grupo.'));
      }
    });
  }

  /**
   * Confirma y publica la convocatoria en el grupo de WhatsApp. Si ya se había publicado,
   * pregunta antes de repetirla; si no hay grupo elegido, abre el panel para elegirlo.
   * @returns el resultado (con el nuevo estado del evento) o null si no se envió.
   */
  async convocar(evento: { id: number; titulo: string }): Promise<ConvocatoriaWhatsApp | null> {
    if (this.enviandoEventoId() !== null) return null;
    this.enviandoEventoId.set(evento.id);
    try {
      const confirmado = await this.dialog.confirmar({
        tipo: 'CONFIRM',
        titulo: 'Convocar por WhatsApp',
        mensaje: `¿Publicar la convocatoria de "${evento.titulo}" en el grupo de WhatsApp de la Junta?`,
        textoConfirmar: 'Publicar convocatoria'
      });
      if (!confirmado) return null;
      return await this.enviar(evento.id, false);
    } catch (err) {
      return await this.resolverError(evento.id, err);
    } finally {
      this.enviandoEventoId.set(null);
    }
  }

  private async enviar(eventoId: number, reenviar: boolean): Promise<ConvocatoriaWhatsApp> {
    const res = await firstValueFrom(this.admin.enviarConvocatoriaWhatsApp(eventoId, reenviar));
    this.notify.success(res.message || 'Convocatoria publicada en el grupo de WhatsApp.');
    return res.data;
  }

  private async resolverError(eventoId: number, err: unknown): Promise<ConvocatoriaWhatsApp | null> {
    const codigo = cuerpoError(err)?.codigo;
    if (codigo === 'CONVOCATORIA_YA_ENVIADA') {
      const repetir = await this.dialog.confirmar({
        tipo: 'WARNING',
        titulo: 'Convocatoria ya publicada',
        mensaje: `${mensajeDe(err, 'Esta convocatoria ya se publicó.')} ¿Desea publicarla otra vez?`,
        textoConfirmar: 'Publicar de nuevo'
      });
      if (!repetir) return null;
      try {
        return await this.enviar(eventoId, true);
      } catch (otro) {
        this.notify.error(mensajeDe(otro, 'No se pudo publicar la convocatoria.'));
        return null;
      }
    }
    if (codigo === 'GRUPO_NO_CONFIGURADO') {
      this.notify.warning(mensajeDe(err, 'Elija primero el grupo de WhatsApp de las convocatorias.'));
      this.abrir();
      return null;
    }
    this.notify.error(mensajeDe(err, 'No se pudo publicar la convocatoria. Revise la conexión de WhatsApp.'));
    return null;
  }

  private aplicarEstado(estado: EstadoWhatsApp): void {
    this.estado.set(estado);
    this.cargando.set(false);
    if (estado.conectado && !this.grupos().length && !this.cargandoGrupos()) this.cargarGrupos();
  }

  private detenerSondeo(): void {
    if (this.sondeo) {
      clearInterval(this.sondeo);
      this.sondeo = null;
    }
  }
}
