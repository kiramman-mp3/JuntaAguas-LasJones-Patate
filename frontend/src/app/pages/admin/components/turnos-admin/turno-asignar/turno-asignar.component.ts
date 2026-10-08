import { Component, DestroyRef, OnInit, inject, output, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, debounceTime, of, switchMap, tap } from 'rxjs';
import { AdminService } from '../../../../../core/services/admin.service';
import { NotificationService } from '../../../../../core/services/notification.service';
import { ModalComponent } from '../../../../../shared/ui/modal.component';
import { DIAS_SEMANA } from '../turno.model';

/**
 * Asignación de un turno de riego: se busca el comunero en el servidor (máximo 20 resultados),
 * se elige uno de sus lotes y el horario semanal. Un turno adicional genera un cobro.
 */
@Component({
  selector: 'app-turno-asignar',
  standalone: true,
  imports: [FormsModule, DecimalPipe, ModalComponent],
  templateUrl: './turno-asignar.component.html'
})
export class TurnoAsignarComponent implements OnInit {
  private admin = inject(AdminService);
  private notify = inject(NotificationService);
  private destroyRef = inject(DestroyRef);

  readonly cerrar = output<void>();
  readonly asignado = output<void>();

  readonly dias = DIAS_SEMANA;
  readonly comuneros = signal<any[]>([]);
  /** Total de comuneros activos que coinciden con la búsqueda (el servidor devuelve como máximo 20). */
  readonly totalComuneros = signal(0);
  readonly buscando = signal(false);
  readonly lotes = signal<any[]>([]);
  readonly cargandoLotes = signal(false);
  readonly guardando = signal(false);

  busqueda = '';
  seleccionado: PersonaListado | null = null;
  turno: Partial<TurnoItem> = {
    persona_id: undefined,
    lote_id: undefined,
    dia_semana: 1,
    hora_inicio: '08:00',
    hora_fin: '10:00',
    tipo: 'REGULAR',
    costo: null,
    observacion: ''
  };

  private busqueda$ = new Subject<string>();

  ngOnInit(): void {
    // La búsqueda se hace en el servidor: no se descarga el padrón completo.
    this.busqueda$
      .pipe(
        debounceTime(250),
        tap(() => this.buscando.set(true)),
        switchMap((termino) => this.admin.getPersonas(1, 20, termino, 'ACTIVO').pipe(catchError(() => of(null)))),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((res) => {
        this.buscando.set(false);
        this.comuneros.set(res?.data ?? []);
        this.totalComuneros.set(res?.pagination?.total ?? res?.data?.length ?? 0);
        if (!res) this.notify.error('No se pudo buscar comuneros. Revise su conexión.');
      });
    this.busqueda$.next('');
  }

  buscar(termino: string): void {
    this.busqueda$.next(termino.trim());
  }

  seleccionar(u: PersonaListado): void {
    this.seleccionado = u;
    this.turno.persona_id = u.id;
    this.turno.lote_id = null;
    this.lotes.set([]);
    this.cargandoLotes.set(true);
    this.admin.getLotes(undefined, undefined, u.id).subscribe({
      next: (res) => {
        const lotes = res?.data ?? [];
        this.lotes.set(lotes);
        if (lotes.length) this.turno.lote_id = lotes[0].id;
        this.cargandoLotes.set(false);
      },
      error: () => {
        this.cargandoLotes.set(false);
        this.notify.error('No se pudieron cargar los lotes del comunero.');
      }
    });
  }

  get generaCobro(): boolean {
    return this.turno.tipo === 'ADICIONAL' || Number(this.turno.costo) > 0;
  }

  guardar(): void {
    const t = this.turno;
    if (!t.persona_id) return this.notify.warning('Debe seleccionar un comunero.');
    if (!t.lote_id) return this.notify.warning('Debe seleccionar un lote para asignar el turno.');
    if (!t.hora_inicio || !t.hora_fin) return this.notify.warning('Debe definir la hora de inicio y fin.');
    if (t.hora_inicio >= t.hora_fin) return this.notify.warning('La hora de fin debe ser posterior a la de inicio.');

    this.guardando.set(true);
    this.admin.asignarTurno(t).subscribe({
      next: (res) => {
        this.guardando.set(false);
        this.notify.success(res.message || 'Turno de agua asignado.');
        this.asignado.emit();
      },
      error: (err) => {
        this.guardando.set(false);
        this.notify.error(err.error?.message || 'Error al asignar el turno.');
      }
    });
  }
}
