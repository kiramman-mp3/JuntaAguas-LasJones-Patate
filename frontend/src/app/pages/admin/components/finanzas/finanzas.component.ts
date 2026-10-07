import { Component, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { FinanzasService } from '../../../../core/services/finanzas.service';
import { Balance } from '../../../../core/models/finanzas';
import { hoyEnEcuador } from '../../../../core/utils/fechas';
import { CobroCajaComponent } from './cobro-caja/cobro-caja.component';
import { HistorialPagosComponent } from './historial-pagos/historial-pagos.component';
import { HistorialFinancieroComponent } from './historial-financiero/historial-financiero.component';
import { EgresosComponent } from './egresos/egresos.component';
import { FacturacionMensualComponent } from './facturacion-mensual/facturacion-mensual.component';
import { TarifasComponent } from './tarifas/tarifas.component';
import { PageHeaderComponent } from '../../../../shared/ui/page-header.component';

export type SeccionFinanzas = 'cobrar' | 'pagos' | 'egresos' | 'historial' | 'facturacion' | 'tarifas';

interface Seccion {
  id: SeccionFinanzas;
  etiqueta: string;
  icono: string;
}

export interface GrupoSecciones {
  id: 'cobros' | 'finanzas';
  etiqueta: string;
  secciones: Seccion[];
}

interface Indicadores {
  mes: Balance;
  historico: Balance;
}

/**
 * Módulo financiero: reemplaza a "Finanzas", "Cobros" y "Gestión de Contratación" y los separa en dos grupos.
 * Cobros: cobro en caja, historial de pagos, facturación mensual y tarifas.
 * Finanzas: egresos e historial financiero anual.
 * Cada sección tiene su URL (/admin/finanzas/egresos); `?nuevo=egreso` abre el formulario de egreso.
 */
@Component({
  selector: 'app-finanzas',
  standalone: true,
  imports: [PageHeaderComponent, CobroCajaComponent, HistorialPagosComponent, EgresosComponent, HistorialFinancieroComponent, FacturacionMensualComponent, TarifasComponent],
  templateUrl: './finanzas.component.html'
})
export class FinanzasComponent {
  private finanzas = inject(FinanzasService);
  private router = inject(Router);

  /** Parámetro de ruta :seccion (texto libre de la URL; se valida en `seccionActual`). */
  readonly seccion = input<string | undefined>();
  /** Parámetro de consulta ?nuevo=egreso (atajo del dashboard). */
  readonly nuevo = input<string | undefined>();

  /**
   * Dos áreas independientes (F08, C12): Cobros, lo que se cobra a los comuneros,
   * y Finanzas, lo que sale de caja y el historial de la Junta.
   */
  readonly grupos: GrupoSecciones[] = [
    { id: 'cobros', etiqueta: 'Cobros', secciones: [
      { id: 'cobrar', etiqueta: 'Cobrar', icono: 'ri-hand-coin-line' },
      { id: 'pagos', etiqueta: 'Pagos', icono: 'ri-file-list-3-line' },
      { id: 'facturacion', etiqueta: 'Facturación', icono: 'ri-calendar-2-line' },
      { id: 'tarifas', etiqueta: 'Tarifas', icono: 'ri-price-tag-3-line' }
    ] },
    { id: 'finanzas', etiqueta: 'Finanzas', secciones: [
      { id: 'egresos', etiqueta: 'Egresos', icono: 'ri-shopping-bag-3-line' },
      { id: 'historial', etiqueta: 'Historial', icono: 'ri-git-branch-line' }
    ] }
  ];
  readonly secciones = this.grupos.flatMap((g) => g.secciones);

  /** Una sección desconocida en la URL muestra el cobro. */
  readonly seccionActual = computed<SeccionFinanzas>(() =>
    this.secciones.find((s) => s.id === this.seccion())?.id ?? 'cobrar');
  readonly abrirEgreso = computed(() => this.seccionActual() === 'egresos' && this.nuevo() === 'egreso');

  readonly grupoActual = computed(() => this.grupos.find((g) => g.secciones.some((s) => s.id === this.seccionActual()))!);

  /** Posición de la sección activa dentro de su grupo (-1 si el grupo no está activo). */
  indiceEn(grupo: GrupoSecciones): number {
    return grupo.secciones.findIndex((s) => s.id === this.seccionActual());
  }

  /** Cada grupo es un tablist con una sola parada de tabulación: la activa o, si no la hay, la primera. */
  tabEnfocable(grupo: GrupoSecciones, id: SeccionFinanzas): boolean {
    const indice = this.indiceEn(grupo);
    return indice >= 0 ? grupo.secciones[indice].id === id : grupo.secciones[0].id === id;
  }

  readonly indicadores = signal<Indicadores | null>(null);
  readonly errorIndicadores = signal(false);

  constructor() {
    this.cargarIndicadores();
  }

  cambiarSeccion(id: SeccionFinanzas): void {
    this.router.navigate(['/admin/finanzas', id]);
  }

  /** Flechas izquierda/derecha entre los segmentos de un grupo, como un grupo de pestañas. */
  onTeclaSegmento(evento: KeyboardEvent, grupo: GrupoSecciones): void {
    if (evento.key !== 'ArrowRight' && evento.key !== 'ArrowLeft') return;
    evento.preventDefault();
    const paso = evento.key === 'ArrowRight' ? 1 : -1;
    const n = grupo.secciones.length;
    const actual = Math.max(grupo.secciones.findIndex((s) => s.id === (evento.target as HTMLElement).id.replace('fin-tab-', '')), 0);
    const siguiente = grupo.secciones[(actual + paso + n) % n];
    this.cambiarSeccion(siguiente.id);
    document.getElementById(`fin-tab-${siguiente.id}`)?.focus();
  }

  cargarIndicadores(): void {
    const hoy = hoyEnEcuador();
    this.errorIndicadores.set(false);
    forkJoin({
      mes: this.finanzas.getBalance(`${hoy.slice(0, 7)}-01`, hoy),
      historico: this.finanzas.getBalance()
    }).subscribe({
      next: ({ mes, historico }) => this.indicadores.set({ mes: mes.balance, historico: historico.balance }),
      error: () => this.errorIndicadores.set(true)
    });
  }

  onDatosCambiados(): void {
    this.cargarIndicadores();
  }
}
