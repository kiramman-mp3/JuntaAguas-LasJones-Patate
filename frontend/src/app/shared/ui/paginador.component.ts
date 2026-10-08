import { Component, computed, input, output } from '@angular/core';

/** Un número de página o null para un salto ("…"). */
export type ItemPaginador = number | null;

/**
 * Páginas a mostrar: todas si son pocas; si no, la primera, la última y las vecinas de la actual,
 * con saltos entre medio. Ej.: actual 6 de 12 → 1 … 5 6 7 … 12.
 */
export function paginasVisibles(actual: number, totalPaginas: number): ItemPaginador[] {
  if (totalPaginas <= 7) return Array.from({ length: totalPaginas }, (_, i) => i + 1);
  const desde = Math.max(2, Math.min(actual - 1, totalPaginas - 4));
  const hasta = Math.min(totalPaginas - 1, Math.max(actual + 1, 5));
  const medio = Array.from({ length: hasta - desde + 1 }, (_, i) => desde + i);
  return [1, ...(desde > 2 ? [null] : []), ...medio, ...(hasta < totalPaginas - 1 ? [null] : []), totalPaginas];
}

/**
 * Pie de un listado paginado: resumen ("Mostrando 26–50 de 120"), cantidad por página y páginas.
 * No carga datos: avisa los cambios y el listado decide si pide la página al servidor o la recorta.
 */
@Component({
  selector: 'app-paginador',
  standalone: true,
  template: `
    <div class="surface__foot paginador">
      <span class="paginador__resumen" aria-live="polite">
        @if (total()) {
          Mostrando <strong>{{ desde() }}–{{ hasta() }}</strong> de <strong>{{ total() }}</strong> {{ etiqueta() }}
        } @else {
          Sin {{ etiqueta() }}
        }
      </span>
      <div class="paginador__controles">
        <label class="paginador__tamano">
          <span>Por página</span>
          <select class="input input--sm" [disabled]="cargando()" (change)="cambiarTamano($event)" aria-label="Registros por página">
            @for (o of opciones(); track o) {
              <option [value]="o" [selected]="o === porPagina()">{{ o }}</option>
            }
          </select>
        </label>
        @if (totalPaginas() > 1) {
          <nav class="pager" aria-label="Paginación">
            <button type="button" class="btn btn--outline btn--sm" [disabled]="pagina() <= 1 || cargando()" (click)="ir(pagina() - 1)" aria-label="Página anterior">
              <i class="ri-arrow-left-s-line" aria-hidden="true"></i>
            </button>
            @for (p of paginas(); track $index) {
              @if (p === null) {
                <span class="pager__salto" aria-hidden="true">…</span>
              } @else {
                <button type="button" class="btn btn--sm pager__num" [class.btn--primary]="p === pagina()" [class.btn--ghost]="p !== pagina()"
                  [class.pager__num--actual]="p === pagina()" [attr.aria-current]="p === pagina() ? 'page' : null"
                  [attr.aria-label]="'Página ' + p" [disabled]="cargando()" (click)="ir(p)">{{ p }}</button>
              }
            }
            <button type="button" class="btn btn--outline btn--sm" [disabled]="pagina() >= totalPaginas() || cargando()" (click)="ir(pagina() + 1)" aria-label="Página siguiente">
              <i class="ri-arrow-right-s-line" aria-hidden="true"></i>
            </button>
          </nav>
        }
      </div>
    </div>
  `
})
export class PaginadorComponent {
  readonly pagina = input.required<number>();
  readonly porPagina = input.required<number>();
  readonly total = input.required<number>();
  /** Nombre en plural de lo que se lista: "comuneros", "lotes"… */
  readonly etiqueta = input('registros');
  readonly opciones = input<number[]>([10, 25, 50, 100]);
  readonly cargando = input(false);

  readonly paginaChange = output<number>();
  readonly porPaginaChange = output<number>();

  readonly totalPaginas = computed(() => Math.max(1, Math.ceil(this.total() / this.porPagina())));
  readonly desde = computed(() => Math.min(this.total(), (this.pagina() - 1) * this.porPagina() + 1));
  readonly hasta = computed(() => Math.min(this.total(), this.pagina() * this.porPagina()));
  readonly paginas = computed(() => paginasVisibles(this.pagina(), this.totalPaginas()));

  ir(pagina: number): void {
    if (pagina < 1 || pagina > this.totalPaginas() || pagina === this.pagina()) return;
    this.paginaChange.emit(pagina);
  }

  cambiarTamano(evento: Event): void {
    const valor = Number((evento.target as HTMLSelectElement).value);
    if (valor > 0 && valor !== this.porPagina()) this.porPaginaChange.emit(valor);
  }
}
