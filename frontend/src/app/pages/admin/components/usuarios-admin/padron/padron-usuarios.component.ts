import { Component, DestroyRef, OnInit, inject, input, signal, effect, untracked } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime } from 'rxjs';
import { AdminService } from '../../../../../core/services/admin.service';
import { LoteItem, PersonaListado, SectorItem } from '../../../../../core/models/api-payloads';
import { EmptyStateComponent } from '../../../../../shared/ui/empty-state.component';
import { SkeletonComponent } from '../../../../../shared/ui/skeleton.component';
import { PaginadorComponent } from '../../../../../shared/ui/paginador.component';
import { UsuarioFormComponent } from '../usuario-form/usuario-form.component';
import { VincularLoteComponent } from '../vincular-lote/vincular-lote.component';
import { LotesUsuarioComponent } from '../lotes-usuario/lotes-usuario.component';
import { LoteDetalleComponent } from '../lote-detalle/lote-detalle.component';

/** Padrón de usuarios: búsqueda en el servidor, paginación y acciones por usuario. */
@Component({
  selector: 'app-padron-usuarios',
  standalone: true,
  imports: [NgClass, FormsModule, EmptyStateComponent, SkeletonComponent, PaginadorComponent, UsuarioFormComponent, VincularLoteComponent, LotesUsuarioComponent, LoteDetalleComponent],
  templateUrl: './padron-usuarios.component.html'
})
export class PadronUsuariosComponent implements OnInit {
  private admin = inject(AdminService);
  private destroyRef = inject(DestroyRef);

  /** ?nuevo=usuario abre el formulario desde el acceso rápido del dashboard. */
  readonly nuevo = input<string | undefined>();

  readonly usuarios = signal<PersonaListado[]>([]);
  readonly sectores = signal<SectorItem[]>([]);
  readonly cargando = signal(true);
  readonly error = signal(false);
  readonly pagina = signal(1);
  readonly porPagina = signal(25);
  readonly total = signal(0);

  busqueda = '';
  estadoFiltro = '';
  sectorFiltro: number | null = null;
  private busqueda$ = new Subject<void>();

  // Modales
  readonly formulario = signal<{ usuario: PersonaListado | null } | null>(null);
  readonly vincularA = signal<PersonaListado | null>(null);
  readonly lotesDeUsuario = signal<PersonaListado | null>(null);
  readonly loteDetalle = signal<LoteItem | null>(null);

  constructor() {
    effect(() => {
      if (this.nuevo() === 'usuario') {
        untracked(() => this.formulario.set({ usuario: null }));
      }
    });
  }

  ngOnInit(): void {
    this.busqueda$.pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.pagina.set(1);
      this.cargar();
    });
    this.cargarSectores();
    this.cargar();
  }

  cargarSectores(): void {
    if (typeof this.admin?.getSectores === 'function') {
      this.admin.getSectores().subscribe({
        next: (res) => {
          if (res?.data) this.sectores.set(res.data);
        },
        error: (err) => {
          console.error('Error cargando sectores:', err);
        }
      });
    }
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set(false);
    const peticion$ = this.sectorFiltro
      ? this.admin.getPersonas(this.pagina(), this.porPagina(), this.busqueda, this.estadoFiltro, this.sectorFiltro)
      : this.admin.getPersonas(this.pagina(), this.porPagina(), this.busqueda, this.estadoFiltro);

    peticion$.subscribe({
      next: (res) => {
        const total = res?.pagination?.total ?? 0;
        // Si la página quedó vacía (por ejemplo, al filtrar), se vuelve a la última que tiene datos.
        const ultima = Math.max(1, Math.ceil(total / this.porPagina()));
        if (this.pagina() > ultima) {
          this.pagina.set(ultima);
          this.cargar();
          return;
        }
        this.usuarios.set(res?.data ?? []);
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
    this.sectorFiltro = null;
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

  verLoteDesdeUsuario(lote: LoteItem): void {
    this.lotesDeUsuario.set(null);
    this.loteDetalle.set(lote);
  }

  asignarOtroTerreno(usuario: PersonaListado): void {
    this.lotesDeUsuario.set(null);
    this.vincularA.set(usuario);
  }

  iniciales(u: PersonaListado): string {
    return `${(u.nombres || '').charAt(0)}${(u.apellidos || '').charAt(0)}`.toUpperCase();
  }
}
