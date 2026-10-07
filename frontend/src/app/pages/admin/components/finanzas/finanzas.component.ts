import { Component, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { FinanzasService } from '../../../../core/services/finanzas.service';
import { Balance } from '../../../../core/models/finanzas';
import { hoyEnEcuador } from '../../../../core/utils/fechas';
import { CobroCajaComponent } from './cobro-caja/cobro-caja.component';
import { HistorialPagosComponent } from './historial-pagos/historial-pagos.component';
import { EgresosComponent } from './egresos/egresos.component';
import { FacturacionMensualComponent } from './facturacion-mensual/facturacion-mensual.component';
import { TarifasComponent } from './tarifas/tarifas.component';

export type SeccionFinanzas = 'cobrar' | 'pagos' | 'egresos' | 'facturacion' | 'tarifas';

interface Indicadores {
  mes: Balance;
  historico: Balance;
}

/**
 * Módulo financiero único: reemplaza a "Finanzas", "Cobros" y "Gestión de Contratación".
 * Reúne el cobro en caja, el historial de pagos, los egresos, la facturación mensual y las tarifas.
 * Cada sección tiene su URL (/admin/finanzas/egresos); `?nuevo=egreso` abre el formulario de egreso.
 */
@Component({
  selector: 'app-finanzas',
  standalone: true,
  imports: [CobroCajaComponent, HistorialPagosComponent, EgresosComponent, FacturacionMensualComponent, TarifasComponent],
  templateUrl: './finanzas.component.html'
})
export class FinanzasComponent {
  private finanzas = inject(FinanzasService);
  private router = inject(Router);

  /** Parámetro de ruta :seccion. */
  readonly seccionRuta = input<string | undefined>(undefined, { alias: 'seccion' });
  /** Parámetro de consulta ?nuevo=egreso (atajo del dashboard). */
  readonly nuevo = input<string | undefined>();

  readonly secciones: { id: SeccionFinanzas; etiqueta: string; icono: string }[] = [
    { id: 'cobrar', etiqueta: 'Cobrar', icono: 'ri-hand-coin-line' },
    { id: 'pagos', etiqueta: 'Pagos', icono: 'ri-file-list-3-line' },
    { id: 'egresos', etiqueta: 'Egresos', icono: 'ri-shopping-bag-3-line' },
    { id: 'facturacion', etiqueta: 'Facturación', icono: 'ri-calendar-2-line' },
    { id: 'tarifas', etiqueta: 'Tarifas', icono: 'ri-price-tag-3-line' }
  ];

  /** Una sección desconocida en la URL muestra el cobro. */
  readonly seccion = computed<SeccionFinanzas>(() =>
    this.secciones.find((s) => s.id === this.seccionRuta())?.id ?? 'cobrar');
  readonly abrirEgreso = computed(() => this.seccion() === 'egresos' && this.nuevo() === 'egreso');

  readonly indiceSeccion = computed(() => this.secciones.findIndex((s) => s.id === this.seccion()));

  readonly indicadores = signal<Indicadores | null>(null);
  readonly errorIndicadores = signal(false);

  constructor() {
    this.cargarIndicadores();
  }

  cambiarSeccion(id: SeccionFinanzas): void {
    this.router.navigate(['/admin/finanzas', id]);
  }

  /** Flechas izquierda/derecha entre segmentos, como un grupo de pestañas. */
  onTeclaSegmento(evento: KeyboardEvent): void {
    if (evento.key !== 'ArrowRight' && evento.key !== 'ArrowLeft') return;
    evento.preventDefault();
    const paso = evento.key === 'ArrowRight' ? 1 : -1;
    const n = this.secciones.length;
    const siguiente = this.secciones[(this.indiceSeccion() + paso + n) % n];
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
