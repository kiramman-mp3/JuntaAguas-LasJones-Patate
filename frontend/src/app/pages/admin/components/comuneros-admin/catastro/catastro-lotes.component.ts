import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime } from 'rxjs';
import { AdminService } from '../../../../../core/services/admin.service';
import { EmptyStateComponent } from '../../../../../shared/ui/empty-state.component';
import { SkeletonComponent } from '../../../../../shared/ui/skeleton.component';
import { LoteFormComponent } from '../lote-form/lote-form.component';
import { LoteDetalleComponent } from '../lote-detalle/lote-detalle.component';

/** Catastro de lotes: búsqueda por código, filtro por sector, alta de lotes y ficha de cada uno. */
@Component({
  selector: 'app-catastro-lotes',
  standalone: true,
  imports: [FormsModule, EmptyStateComponent, SkeletonComponent, LoteFormComponent, LoteDetalleComponent],
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

  busqueda = '';
  sectorFiltro: number | null = null;
  private busqueda$ = new Subject<void>();

  ngOnInit(): void {
    this.busqueda$.pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef)).subscribe(() => this.cargar());
    this.admin.getSectores().subscribe({ next: (res) => this.sectores.set(res?.data ?? []) });
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set(false);
    this.admin.getLotes(this.sectorFiltro || undefined, this.busqueda).subscribe({
      next: (res) => {
        this.lotes.set(res?.data ?? []);
        this.cargando.set(false);
      },
      error: () => {
        this.error.set(true);
        this.cargando.set(false);
      }
    });
  }

  filtrar(inmediato = false): void {
    if (inmediato) this.cargar();
    else this.busqueda$.next();
  }

  limpiarFiltros(): void {
    this.busqueda = '';
    this.sectorFiltro = null;
    this.cargar();
  }

  onCreado(): void {
    this.formularioAbierto.set(false);
    this.cargar();
  }
}
