import {
  ChangeDetectorRef,
  Component,
  DestroyRef,
  EventEmitter,
  OnInit,
  Output,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, forkJoin } from 'rxjs';
import { AdminService } from '../../../../core/services/admin.service';
import { ConsultaService } from '../../../../core/services/consulta.service';

interface Minga {
  id: number;
  tipo: 'MINGA';
  titulo: string;
  descripcion: string;
  fecha: string;
  hora_inicio: string;
  lugar: string;
  estado: string;
  genera_multa_ausencia: boolean;
  valor_multa: number;
  asistentes: number;
  totalComuneros: number;
  lista_asistencia_firmada_url?: string;
}

type EstadoAsistencia = 'PENDIENTE' | 'PRESENTE' | 'AUSENTE' | 'JUSTIFICADO';
interface Asistencia {
  persona_id: number;
  nombre: string;
  cedula: string;
  estado: EstadoAsistencia;
  motivo_justificacion: string;
}

@Component({
  selector: 'app-mingas-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './mingas-admin.component.html',
  styleUrls: ['./mingas-admin.component.scss'],
})
export class MingasAdminComponent implements OnInit {
  @Output() conectarWhatsApp = new EventEmitter<void>();
  private readonly destroyRef = inject(DestroyRef);
  mingas: Minga[] = [];
  cargando = false;
  error = '';
  mensaje = '';
  busqueda = '';
  periodo: 'TODAS' | 'PROXIMAS' | 'ANTERIORES' = 'TODAS';
  modalNueva = false;
  guardando = false;
  errorFormulario = '';
  enviandoId: number | null = null;
  actualizandoId: number | null = null;
  subiendoId: number | null = null;
  descargandoId: number | null = null;
  seleccionada: Minga | null = null;
  cargandoAsistencia = false;
  guardandoAsistencia = false;
  errorAsistencia = '';
  private asistenciaDisponible = false;
  private destruido = false;
  buscarComunero = '';
  asistencias: Asistencia[] = [];
  formulario = this.nuevoFormulario();

  constructor(
    private admin: AdminService,
    private consulta: ConsultaService,
    private cdr: ChangeDetectorRef,
  ) {
    this.destroyRef.onDestroy(() => {
      this.destruido = true;
    });
  }

  ngOnInit() {
    this.cargar();
  }

  private fechaLocal() {
    const hoy = new Date();
    return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
  }

  private nuevoFormulario() {
    return {
      titulo: '',
      descripcion: '',
      fecha: this.fechaLocal(),
      hora_inicio: '08:00',
      lugar: '',
      genera_multa_ausencia: true,
      valor_multa: 10,
    };
  }

  get mingasFiltradas() {
    const texto = this.busqueda.trim().toLocaleLowerCase('es');
    const hoy = this.fechaLocal();
    return this.mingas.filter(
      (m) =>
        (!texto || `${m.titulo} ${m.lugar}`.toLocaleLowerCase('es').includes(texto)) &&
        (this.periodo === 'TODAS' ||
          (this.periodo === 'PROXIMAS' ? m.fecha >= hoy : m.fecha < hoy)),
    );
  }

  get asistenciasFiltradas() {
    const texto = this.buscarComunero.trim().toLocaleLowerCase('es');
    return this.asistencias.filter((a) =>
      `${a.nombre} ${a.cedula}`.toLocaleLowerCase('es').includes(texto),
    );
  }

  get totalPresentes() {
    return this.asistencias.filter((a) => a.estado === 'PRESENTE').length;
  }

  get asistenciaCerrada() {
    return this.seleccionada?.estado === 'REALIZADO' || this.seleccionada?.estado === 'CANCELADO';
  }

  cambiarEstado(minga: Minga, estado: 'PROGRAMADO' | 'CONVOCADO' | 'CANCELADO', desdeEnvio = false) {
    if (this.actualizandoId !== null || (!desdeEnvio && this.enviandoId !== null)) return;
    if (estado === 'CANCELADO' && !confirm(`¿Cancelar la minga "${minga.titulo}"? Su asistencia quedará cerrada y no se generarán multas.`)) return;
    this.actualizandoId = minga.id;
    this.error = '';
    this.admin.cambiarEstadoMinga(minga.id, estado).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => {
      this.actualizandoId = null;
      this.cdr.markForCheck();
    })).subscribe({
      next: res => { minga.estado = res.estado; if (!desdeEnvio) this.mensaje = res.message; this.cargar(); },
      error: err => this.error = (desdeEnvio ? 'La convocatoria se envió, pero no se pudo actualizar el estado. ' : '')
        + (err.error?.message || 'No se pudo actualizar la minga.')
    });
  }

  finalizarMinga(minga: Minga) {
    if (this.actualizandoId !== null || this.enviandoId !== null || ['REALIZADO', 'CANCELADO'].includes(minga.estado)) return;
    if (!confirm(`¿Finalizar "${minga.titulo}"? Se cerrará la asistencia y se registrarán las multas por ausencias, si aplican.`)) return;
    this.actualizandoId = minga.id;
    this.error = '';
    this.admin.finalizarMinga(minga.id).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => {
      this.actualizandoId = null;
      this.cdr.markForCheck();
    })).subscribe({
      next: res => { minga.estado = res.estado; this.mensaje = res.message; this.cargar(); },
      error: err => this.error = err.error?.message || 'No se pudo finalizar la minga.'
    });
  }

  estadoTexto(estado: string) {
    const etiquetas: Record<string, string> = {
      BORRADOR: 'Borrador',
      PROGRAMADO: 'Programada',
      CONVOCADO: 'Convocada',
      REALIZADO: 'Realizada',
      CANCELADO: 'Cancelada',
    };
    return etiquetas[estado] || 'Sin estado';
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
        }),
      )
      .subscribe({
        next: (res) => {
          this.mingas = (res.data || [])
            .filter((m: Minga) => m.tipo === 'MINGA')
            .map((m: Minga) => ({
              ...m,
              fecha: String(m.fecha || '').split('T')[0],
              asistentes: Number(m.asistentes) || 0,
              totalComuneros: Number(m.totalComuneros) || 0,
              valor_multa: Number(m.valor_multa) || 0,
              genera_multa_ausencia: Boolean(m.genera_multa_ausencia),
            }));
        },
        error: (err) =>
          (this.error =
            err.error?.message || 'No se pudieron cargar las mingas. Intente nuevamente.'),
      });
  }

  abrirNueva() {
    this.formulario = this.nuevoFormulario();
    this.errorFormulario = '';
    this.modalNueva = true;
  }

  guardarNueva() {
    if (this.guardando) return;
    const f = this.formulario;
    if (
      !f.titulo.trim() ||
      !f.descripcion.trim() ||
      !f.lugar.trim() ||
      !f.fecha ||
      !f.hora_inicio ||
      (f.genera_multa_ausencia &&
        (!Number.isFinite(Number(f.valor_multa)) || Number(f.valor_multa) <= 0))
    ) {
      this.errorFormulario =
        'Complete la actividad, fecha, hora y lugar. Si aplica multa, ingrese un valor mayor a cero.';
      return;
    }
    this.guardando = true;
    this.errorFormulario = '';
    // Una minga no tiene subtipo de asamblea ni puntos de orden del día.
    const payload = {
      ...f,
      tipo: 'MINGA',
      titulo: f.titulo.trim(),
      descripcion: f.descripcion.trim(),
      lugar: f.lugar.trim(),
      requiere_asistencia: true,
      valor_multa: f.genera_multa_ausencia ? Number(f.valor_multa) : 0,
    };
    this.admin
      .createEvento(payload)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.guardando = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: () => {
          this.modalNueva = false;
          this.mensaje =
            'Minga registrada. Puede enviar la convocatoria por WhatsApp desde sus acciones.';
          this.cargar();
        },
        error: (err) =>
          (this.errorFormulario = err.error?.message || 'No se pudo registrar la minga.'),
      });
  }

  enviarConvocatoria(minga: Minga) {
    if (this.enviandoId !== null || this.actualizandoId !== null || minga.estado === 'CANCELADO' || minga.estado === 'REALIZADO')
      return;
    if (
      !confirm(
        `¿Enviar la convocatoria de "${minga.titulo}" a todos los comuneros activos con teléfono? Un nuevo envío repetirá la convocatoria.`,
      )
    )
      return;
    this.enviandoId = minga.id;
    this.error = '';
    this.mensaje = '';
    this.admin
      .notificarMingaWhatsApp(minga.id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.enviandoId = null;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: (res) => {
          this.mensaje = res.message || 'Convocatoria enviada.';
          if (Number(res.enviados) > 0 && minga.estado !== 'CONVOCADO') this.cambiarEstado(minga, 'CONVOCADO', true);
        },
        error: (err) =>
          (this.error =
            err.error?.message ||
            'No se pudo enviar. Revise la conexión de WhatsApp y vuelva a intentarlo.'),
      });
  }

  abrirAsistencia(minga: Minga) {
    if (minga.estado === 'CANCELADO') return;
    this.seleccionada = minga;
    this.asistencias = [];
    this.buscarComunero = '';
    this.errorAsistencia = '';
    this.asistenciaDisponible = false;
    this.cargandoAsistencia = true;
    forkJoin({
      personas: this.admin.getPersonas(1, 9999, '', 'ACTIVO'),
      registros: this.admin.getAsistencias(minga.id),
    })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.cargandoAsistencia = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: ({ personas, registros }) => {
          if (this.seleccionada?.id !== minga.id) return;
          const previos = new Map<number, any>(
            (registros.data || []).map((a: any) => [Number(a.persona_id), a]),
          );
          this.asistenciaDisponible = true;
          this.asistencias = (personas.data || []).map((p: any) => ({
            persona_id: Number(p.id),
            nombre: `${p.apellidos} ${p.nombres}`,
            cedula: p.cedula,
            estado: previos.get(Number(p.id))?.estado || 'PENDIENTE',
            motivo_justificacion: previos.get(Number(p.id))?.motivo_justificacion || '',
          }));
        },
        error: () =>
          (this.errorAsistencia =
            'No se pudieron cargar los comuneros y sus asistencias. Cierre y vuelva a abrir el registro.'),
      });
  }

  marcarPresentes() {
    if (this.asistenciaCerrada) return;
    // Respeta las justificaciones previamente registradas.
    this.asistenciasFiltradas
      .filter((a) => a.estado !== 'JUSTIFICADO')
      .forEach((a) => (a.estado = 'PRESENTE'));
  }

  guardarAsistencia() {
    if (
      !this.seleccionada ||
      this.asistenciaCerrada ||
      this.guardandoAsistencia ||
      this.cargandoAsistencia ||
      !this.asistenciaDisponible ||
      !this.asistencias.length
    )
      return;
    this.errorAsistencia = '';
    if (
      this.asistencias.some((a) => a.estado === 'JUSTIFICADO' && !a.motivo_justificacion.trim())
    ) {
      this.errorAsistencia = 'Escriba el motivo de cada ausencia justificada.';
      return;
    }
    const minga = this.seleccionada;
    const payload = this.asistencias.map((a) => ({
      persona_id: a.persona_id,
      estado: a.estado,
      motivo_justificacion: a.estado === 'JUSTIFICADO' ? a.motivo_justificacion.trim() : null,
    }));
    this.guardandoAsistencia = true;
    this.admin
      .registrarAsistenciasMinga(minga.id, payload)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.guardandoAsistencia = false;
          this.cdr.markForCheck();
        }),
      )
      .subscribe({
        next: () => {
          this.seleccionada = null;
          this.mensaje = 'Asistencia de la minga guardada.';
          this.cargar();
        },
        error: (err) =>
          (this.errorAsistencia =
            err.error?.message || 'No se pudo guardar la asistencia. Intente nuevamente.'),
      });
  }

  descargarLista(minga: Minga) {
    if (this.descargandoId !== null) return;
    this.descargandoId = minga.id;
    this.error = '';
    this.consulta
      .descargarListaAsistencia(minga.id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.descargandoId = null;
          this.cdr.markForCheck();
        }),
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
        error: () => (this.error = 'No se pudo descargar la lista de asistencia.'),
      });
  }

  subirLista(minga: Minga, input: HTMLInputElement) {
    const archivo = input.files?.[0];
    input.value = '';
    if (!archivo || this.subiendoId !== null) return;
    if (
      !['application/pdf', 'image/jpeg', 'image/png'].includes(archivo.type) ||
      archivo.size > 10 * 1024 * 1024 ||
      archivo.size === 0
    ) {
      this.error = 'Seleccione un PDF, JPG o PNG válido de hasta 10 MB.';
      return;
    }
    this.subiendoId = minga.id;
    this.error = '';
    archivo
      .arrayBuffer()
      .then((buffer) => {
        if (this.destruido) return;
        const bytes = new Uint8Array(buffer);
        const partes: string[] = [];
        for (let i = 0; i < bytes.length; i += 8192)
          partes.push(String.fromCharCode(...bytes.subarray(i, i + 8192)));
        const base64 = `data:${archivo.type};base64,${btoa(partes.join(''))}`;
        this.consulta
          .subirDocumentoEvento(minga.id, 'OTRO', archivo.name, base64)
          .pipe(
            takeUntilDestroyed(this.destroyRef),
            finalize(() => {
              this.subiendoId = null;
              this.cdr.markForCheck();
            }),
          )
          .subscribe({
            next: () => {
              this.mensaje = 'Lista firmada guardada.';
              this.cargar();
            },
            error: (err) =>
              (this.error = err.error?.message || 'No se pudo subir la lista firmada.'),
          });
      })
      .catch(() => {
        if (this.destruido) return;
        this.subiendoId = null;
        this.error = 'No se pudo leer el archivo seleccionado.';
        this.cdr.markForCheck();
      });
  }

  verLista(minga: Minga) {
    if (minga.lista_asistencia_firmada_url)
      window.open(
        this.consulta.urlDocumento(minga.lista_asistencia_firmada_url),
        '_blank',
        'noopener',
      );
  }
}
