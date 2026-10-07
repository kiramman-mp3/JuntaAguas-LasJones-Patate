import { Component, OnInit, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, debounceTime, of, switchMap } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../../core/services/admin.service';
import { ModalA11yDirective } from '../../../../core/directives/modal-a11y.directive';
import { NotificationService } from '../../../../core/services/notification.service';
import { DialogService } from '../../../../core/services/dialog.service';

@Component({
  selector: 'app-turnos-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalA11yDirective],
  templateUrl: './turnos-admin.component.html',
  styleUrls: ['./turnos-admin.component.scss']
})
export class TurnosAdminComponent implements OnInit {
  turnos: any[] = [];
  vistaTurnosModo: 'TABLA' | 'CALENDARIO' = 'TABLA';
  turnosBusqueda: string = '';
  turnosDiaFiltro: string = '';
  turnosTipoFiltro: string = '';

  get turnosFiltrados() {
    let filtrados = this.turnos;

    if (this.turnosBusqueda.trim()) {
      const termino = this.turnosBusqueda.toLowerCase();
      filtrados = filtrados.filter(t =>
        (t.usuario && t.usuario.toLowerCase().includes(termino)) ||
        (t.lote && t.lote.toLowerCase().includes(termino)) ||
        (t.sector && t.sector.toLowerCase().includes(termino))
      );
    }

    if (this.turnosDiaFiltro) {
      filtrados = filtrados.filter(t => t.dia === this.turnosDiaFiltro);
    }

    if (this.turnosTipoFiltro) {
      filtrados = filtrados.filter(t => t.tipo === this.turnosTipoFiltro);
    }

    return filtrados;
  }

  getTurnosPorDia(diaNum: number) {
    const diasNombres = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    const diaNombre = diasNombres[diaNum];
    return this.turnosFiltrados.filter(t => Number(t.dia_semana) === diaNum || t.dia === diaNombre);
  }

  
  modalTurnoVisible: boolean = false;
  modalEditarTurnoVisible: boolean = false;
  modalDetalleTurnoVisible: boolean = false;
  
  turnoSeleccionadoParaDetalle: any = null;
  turnoEnEdicion: any = null;
  
  nuevoTurno: any = {
    persona_id: null,
    lote_id: null,
    dia_semana: 1,
    hora_inicio: '08:00',
    hora_fin: '10:00',
    tipo: 'REGULAR',
    observacion: ''
  };

  usuariosTurnoModal: any[] = [];
  /** Total de comuneros activos que coinciden con la búsqueda (el servidor devuelve como máximo 20). */
  usuariosTurnoModalTotal = 0;
  buscandoComunerosTurno = false;
  busquedaComuneroTurnoModal: string = '';
  private busquedaTurno$ = new Subject<string>();
  private destroyRef = inject(DestroyRef);
  comuneroSeleccionadoTurno: any = null;
  lotesDisponiblesTurno: any[] = [];

  diasSemana = [
    { valor: 1, label: 'Lunes' },
    { valor: 2, label: 'Martes' },
    { valor: 3, label: 'Miércoles' },
    { valor: 4, label: 'Jueves' },
    { valor: 5, label: 'Viernes' },
    { valor: 6, label: 'Sábado' },
    { valor: 7, label: 'Domingo' }
  ];

  constructor(private adminService: AdminService, private cdr: ChangeDetectorRef, private notify: NotificationService, private dialog: DialogService) {}

  ngOnInit(): void {
    this.cargarTurnos();
    // La búsqueda se hace en el servidor: no se descarga el padrón completo.
    this.busquedaTurno$.pipe(
      debounceTime(250),
      switchMap((termino) => {
        this.buscandoComunerosTurno = true;
        return this.adminService.getPersonas(1, 20, termino, 'ACTIVO').pipe(catchError(() => of(null)));
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((res: any) => {
      this.buscandoComunerosTurno = false;
      this.usuariosTurnoModal = res?.data ?? [];
      this.usuariosTurnoModalTotal = res?.pagination?.total ?? this.usuariosTurnoModal.length;
      if (!res) this.notify.error('No se pudo buscar comuneros. Revise su conexión.');
      this.cdr.detectChanges();
    });
  }

  buscarComunerosTurno(termino: string) {
    this.busquedaTurno$.next(termino.trim());
  }

  cargarTurnos() {
    const diasNombres = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    this.adminService.getTurnos().subscribe({
      next: (res: any) => {
        if (res && res.data) {
          this.turnos = res.data.map((t: any) => ({
            ...t,
            // Aliases para compatibilidad con el template y filtros
            usuario: t.comunero_nombre || `${t.nombres || ''} ${t.apellidos || ''}`.trim(),
            lote: t.lote_codigo || 'N/A',
            sector: t.sector_nombre || 'N/A',
            dia: diasNombres[t.dia_semana] || String(t.dia_semana),
            horaInicio: t.hora_inicio,
            horaFin: t.hora_fin,
            dia_semana_nombre: this.diasSemana.find(d => d.valor === t.dia_semana)?.label || diasNombres[t.dia_semana]
          }));
          this.cdr.detectChanges();
        }
      },
      error: (err: any) => console.error('Error al cargar turnos:', err)
    });
  }

  abrirModalTurno() {
    this.busquedaComuneroTurnoModal = '';
    this.nuevoTurno = {
      persona_id: null,
      lote_id: null,
      dia_semana: 1,
      hora_inicio: '08:00',
      hora_fin: '10:00',
      tipo: 'REGULAR',
      observacion: ''
    };
    this.lotesDisponiblesTurno = [];
    this.modalTurnoVisible = true;

    this.usuariosTurnoModal = [];
    this.busquedaTurno$.next('');
  }

  cerrarModalTurno() {
    this.modalTurnoVisible = false;
  }

  seleccionarComuneroTurnoModal(u: any) {
    this.comuneroSeleccionadoTurno = u;
    this.nuevoTurno.persona_id = u.id;
    this.busquedaComuneroTurnoModal = `${u.nombres} ${u.apellidos} - ${u.cedula}`;
    this.onPersonaChangeInTurno();
  }

  onPersonaChangeInTurno() {
    this.nuevoTurno.lote_id = null;
    this.lotesDisponiblesTurno = [];
    
    if (!this.nuevoTurno.persona_id) return;
    
    this.adminService.getLotes(undefined, undefined, this.nuevoTurno.persona_id).subscribe({
      next: (res: any) => {
        this.lotesDisponiblesTurno = res.data || [];
        if (this.lotesDisponiblesTurno.length > 0) {
          this.nuevoTurno.lote_id = this.lotesDisponiblesTurno[0].id;
        }
        this.cdr.detectChanges();
      }
    });
  }

  guardarTurno() {
    if (!this.nuevoTurno.persona_id) {
      this.notify.warning('Debe seleccionar un comunero.');
      return;
    }
    if (!this.nuevoTurno.lote_id) {
      this.notify.warning('Debe seleccionar un lote para asignar el turno.');
      return;
    }
    if (!this.nuevoTurno.hora_inicio || !this.nuevoTurno.hora_fin) {
      this.notify.warning('Debe definir la hora de inicio y fin.');
      return;
    }
    if (this.nuevoTurno.hora_inicio >= this.nuevoTurno.hora_fin) {
      this.notify.warning('La hora de fin debe ser posterior a la de inicio.');
      return;
    }

    this.adminService.asignarTurno(this.nuevoTurno).subscribe({
      next: (res: any) => {
        this.notify.success(res.message || 'Turno de agua asignado con éxito.');
        this.cerrarModalTurno();
        this.cargarTurnos();
      },
      error: (err: any) => {
        this.notify.error(err.error?.message || 'Error al asignar el turno.');
      }
    });
  }

  verDetalleTurno(turno: any) {
    this.turnoSeleccionadoParaDetalle = { ...turno };
    this.modalDetalleTurnoVisible = true;
  }

  cerrarModalDetalleTurno() {
    this.modalDetalleTurnoVisible = false;
    this.turnoSeleccionadoParaDetalle = null;
  }

  abrirModalEditarTurno(turno: any) {
    this.turnoEnEdicion = {
      id: turno.id,
      persona_id: turno.persona_id,
      lote_id: turno.lote_id,
      usuario: turno.usuario,
      lote: turno.lote,
      dia_semana: turno.dia_semana || 1,
      hora_inicio: turno.horaInicio || '08:00',
      hora_fin: turno.horaFin || '10:00',
      tipo: turno.tipo || 'REGULAR',
      observacion: turno.observacion || ''
    };
    this.modalEditarTurnoVisible = true;
  }

  cerrarModalEditarTurno() {
    this.modalEditarTurnoVisible = false;
    this.turnoEnEdicion = null;
  }

  guardarEdicionTurno() {
    if (!this.turnoEnEdicion) return;

    if (!this.turnoEnEdicion.dia_semana || !this.turnoEnEdicion.hora_inicio || !this.turnoEnEdicion.hora_fin) {
      this.notify.warning('Día de semana y horarios son requeridos.');
      return;
    }
    if (this.turnoEnEdicion.hora_inicio >= this.turnoEnEdicion.hora_fin) {
      this.notify.warning('La hora de fin debe ser mayor a la hora de inicio.');
      return;
    }

    const payload = {
      persona_id: this.turnoEnEdicion.persona_id,
      lote_id: this.turnoEnEdicion.lote_id,
      dia_semana: this.turnoEnEdicion.dia_semana,
      hora_inicio: this.turnoEnEdicion.hora_inicio,
      hora_fin: this.turnoEnEdicion.hora_fin,
      tipo: this.turnoEnEdicion.tipo,
      observacion: this.turnoEnEdicion.observacion
    };

    this.adminService.actualizarTurno(this.turnoEnEdicion.id, payload).subscribe({
      next: (res: any) => {
        this.notify.success(res.message || 'Turno actualizado correctamente.');
        this.cerrarModalEditarTurno();
        this.cargarTurnos();
      },
      error: (err: any) => this.notify.error(err.error?.message || 'Error al actualizar el turno.')
    });
  }

  async eliminarTurno(turno: any) {
    const confirmado = await this.dialog.confirmar({
      tipo: 'DANGER',
      titulo: 'Eliminar turno',
      mensaje: `¿Está seguro de eliminar el turno asignado a "${turno.usuario}" (${turno.dia} ${turno.horaInicio} - ${turno.horaFin})?`,
      textoConfirmar: 'Eliminar'
    });
    if (!confirmado) return;

    this.adminService.eliminarTurno(turno.id).subscribe({
      next: (res: any) => {
        this.notify.success(res.message || 'Turno eliminado con éxito.');
        this.cargarTurnos();
      },
      error: (err: any) => this.notify.error(err.error?.message || 'Error al eliminar el turno.')
    });
  }
}
