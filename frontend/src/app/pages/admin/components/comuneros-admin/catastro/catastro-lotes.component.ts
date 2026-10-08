import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime } from 'rxjs';
import { AdminService } from '../../../../../core/services/admin.service';
import { EmptyStateComponent } from '../../../../../shared/ui/empty-state.component';
import { SkeletonComponent } from '../../../../../shared/ui/skeleton.component';
import { PaginadorComponent } from '../../../../../shared/ui/paginador.component';
import { LoteFormComponent } from '../lote-form/lote-form.component';
import { LoteDetalleComponent } from '../lote-detalle/lote-detalle.component';
import { SectorFormComponent } from '../sector-form/sector-form.component';

/** Catastro de lotes: búsqueda por código, filtro por sector, paginación en el servidor, alta de lotes y ficha de cada uno. */
@Component({
  selector: 'app-catastro-lotes',
  standalone: true,
  imports: [FormsModule, EmptyStateComponent, SkeletonComponent, PaginadorComponent, LoteFormComponent, LoteDetalleComponent, SectorFormComponent],
  templateUrl: './catastro-lotes.component.html'
})
export class CatastroLotesComponent implements OnInit {
  private admin = inject(AdminService);
  private destroyRef = inject(DestroyRef);

  readonly lotes = signal<any[]>([]);
  readonly sectores = signal<any[]>([]);
  readonly cargando = signal(true);
  readonly error = signal(false);
  readonly formularioAbierto = signal(false);
  readonly detalle = signal<any | null>(null);
  readonly sectorAbierto = signal(false);
  readonly pagina = signal(1);
  readonly porPagina = signal(25);
  readonly total = signal(0);

  busqueda = '';
  sectorFiltro: number | null = null;
  private busqueda$ = new Subject<void>();

  ngOnInit(): void {
    this.busqueda$.pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.pagina.set(1);
      this.cargar();
    });
    this.cargarSectores();
    this.cargar();
  }

  cargarSectores(): void {
    this.admin.getSectores().subscribe({ next: (res) => this.sectores.set(res?.data ?? []) });
  }

  onSectorCreado(): void {
    this.sectorAbierto.set(false);
    this.cargarSectores();
  }

  /** Sin sectores no se pueden registrar lotes: se pide crear uno primero. */
  nuevoLote(): void {
    if (this.sectores().length) this.formularioAbierto.set(true);
    else this.sectorAbierto.set(true);
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set(false);
    this.admin.getLotesPaginados(this.pagina(), this.porPagina(), this.sectorFiltro || undefined, this.busqueda).subscribe({
      next: (res) => {
        const total = res?.pagination?.total ?? 0;
        // Si la página quedó vacía (por ejemplo, al filtrar), se vuelve a la última que tiene datos.
        const ultima = Math.max(1, Math.ceil(total / this.porPagina()));
        if (this.pagina() > ultima) {
          this.pagina.set(ultima);
          this.cargar();
          return;
        }
        this.lotes.set(res?.data ?? []);
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

  onCreado(): void {
    this.formularioAbierto.set(false);
    this.cargar();
  }
}
