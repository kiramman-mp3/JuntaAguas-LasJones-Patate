import { Component, DestroyRef, OnInit, inject, input, signal, effect, untracked } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime } from 'rxjs';
import { AdminService } from '../../../../../core/services/admin.service';
import { PersonaListado } from '../../../../../core/models/api-payloads';
import { EmptyStateComponent } from '../../../../../shared/ui/empty-state.component';
import { SkeletonComponent } from '../../../../../shared/ui/skeleton.component';
import { PaginadorComponent } from '../../../../../shared/ui/paginador.component';
import { ComuneroFormComponent } from '../comunero-form/comunero-form.component';
import { VincularLoteComponent } from '../vincular-lote/vincular-lote.component';
import { LotesComuneroComponent } from '../lotes-comunero/lotes-comunero.component';
import { LoteDetalleComponent } from '../lote-detalle/lote-detalle.component';

/** Padrón de comuneros: búsqueda en el servidor, paginación y acciones por comunero. */
@Component({
  selector: 'app-padron-comuneros',
  standalone: true,
  imports: [NgClass, FormsModule, EmptyStateComponent, SkeletonComponent, PaginadorComponent, ComuneroFormComponent, VincularLoteComponent, LotesComuneroComponent, LoteDetalleComponent],
  templateUrl: './padron-comuneros.component.html'
})
export class PadronComunerosComponent implements OnInit {
  private admin = inject(AdminService);
  private destroyRef = inject(DestroyRef);

  /** ?nuevo=comunero abre el registro de un comunero (atajo del dashboard). */
  readonly nuevo = input<string | undefined>();

  readonly comuneros = signal<any[]>([]);
  readonly cargando = signal(true);
  readonly error = signal(false);
  readonly pagina = signal(1);
  readonly porPagina = signal(25);
  readonly total = signal(0);

  busqueda = '';
  estadoFiltro = '';
  private busqueda$ = new Subject<void>();

  // Modales
  readonly formulario = signal<{ comunero: PersonaListado | null } | null>(null);
  readonly vincularA = signal<PersonaListado | null>(null);
  readonly lotesDe = signal<PersonaListado | null>(null);
  readonly loteDetalle = signal<any | null>(null);

  constructor() {
    effect(() => {
      if (this.nuevo() === 'comunero') untracked(() => this.formulario.set({ comunero: null }));
    });
  }

  ngOnInit(): void {
    this.busqueda$.pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.pagina.set(1);
      this.cargar();
    });
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set(false);
    this.admin.getPersonas(this.pagina(), this.porPagina(), this.busqueda, this.estadoFiltro).subscribe({
      next: (res) => {
        const total = res?.pagination?.total ?? 0;
        // Si la página quedó vacía (por ejemplo, al filtrar), se vuelve a la última que tiene datos.
        const ultima = Math.max(1, Math.ceil(total / this.porPagina()));
        if (this.pagina() > ultima) {
          this.pagina.set(ultima);
          this.cargar();
          return;
        }
        this.comuneros.set(res?.data ?? []);
        this.total.set(total);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set(true);
        this.cargando.set(false);
      }
    });
  }

  filtrar(inmediato = false): void {
    if (inmediato) {
      this.pagina.set(1);
      this.cargar();
    } else {
      this.busqueda$.next();
    }
  }

  limpiarFiltros(): void {
    this.busqueda = '';
    this.estadoFiltro = '';
    this.filtrar(true);
  }

  cambiarPagina(nueva: number): void {
    this.pagina.set(nueva);
    this.cargar();
  }

  cambiarPorPagina(cantidad: number): void {
    this.porPagina.set(cantidad);
    this.pagina.set(1);
    this.cargar();
  }

  onGuardado(): void {
    this.formulario.set(null);
    this.cargar();
  }

  onVinculado(): void {
    this.vincularA.set(null);
    this.cargar();
  }

  verLoteDesdeComunero(lote: any): void {
    this.lotesDe.set(null);
    this.loteDetalle.set(lote);
  }

  asignarOtroTerreno(comunero: PersonaListado): void {
    this.lotesDe.set(null);
    this.vincularA.set(comunero);
  }

  iniciales(u: PersonaListado): string {
    return `${(u.nombres || '').charAt(0)}${(u.apellidos || '').charAt(0)}`.toUpperCase();
  }
}
