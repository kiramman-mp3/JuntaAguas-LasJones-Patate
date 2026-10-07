import { Component, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { FinanzasService } from '../../../../core/services/finanzas.service';
import { Balance } from '../../../../core/models/finanzas';
import { hoyEnEcuador } from '../../../../core/utils/fechas';
import { CobroCajaComponent } from './cobro-caja/cobro-caja.component';
import { HistorialPagosComponent } from './historial-pagos/historial-pagos.component';
import { EgresosComponent } from './egresos/egresos.component';
import { FacturacionMensualComponent } from './facturacion-mensual/facturacion-mensual.component';
import { TarifasComponent } from './tarifas/tarifas.component';

export type SeccionFinanzas = 'COBRAR' | 'PAGOS' | 'EGRESOS' | 'FACTURACION' | 'TARIFAS';

interface Indicadores {
  mes: Balance;
  historico: Balance;
}

/**
 * Módulo financiero único: reemplaza a "Finanzas", "Cobros" y "Gestión de Contratación".
 * Reúne el cobro en caja, el historial de pagos, los egresos, la facturación mensual y las tarifas.
 */
@Component({
  selector: 'app-finanzas',
  standalone: true,
  imports: [CobroCajaComponent, HistorialPagosComponent, EgresosComponent, FacturacionMensualComponent, TarifasComponent],
  templateUrl: './finanzas.component.html'
})
export class FinanzasComponent {
  private finanzas = inject(FinanzasService);

  /** Sección inicial (por ejemplo, desde un atajo del dashboard). */
  readonly seccionInicial = input<SeccionFinanzas>('COBRAR');
  /** Abre directamente el formulario de un egreso nuevo. */
  readonly nuevoEgreso = input(false);
  /** Se emite cuando cambian los datos, para refrescar el dashboard. */
  readonly datosCambiados = output<void>();

  readonly seccion = linkedSignal(() => this.seccionInicial());
  /** El formulario de egreso se abre una sola vez, no cada vez que se vuelve a la pestaña. */
  readonly egresoPendiente = linkedSignal(() => this.nuevoEgreso());

  readonly secciones: { id: SeccionFinanzas; etiqueta: string; icono: string }[] = [
    { id: 'COBRAR', etiqueta: 'Cobrar', icono: 'ri-hand-coin-line' },
    { id: 'PAGOS', etiqueta: 'Pagos', icono: 'ri-file-list-3-line' },
    { id: 'EGRESOS', etiqueta: 'Egresos', icono: 'ri-shopping-bag-3-line' },
    { id: 'FACTURACION', etiqueta: 'Facturación', icono: 'ri-calendar-2-line' },
    { id: 'TARIFAS', etiqueta: 'Tarifas', icono: 'ri-price-tag-3-line' }
  ];

  readonly indiceSeccion = computed(() => this.secciones.findIndex((s) => s.id === this.seccion()));

  readonly indicadores = signal<Indicadores | null>(null);
  readonly errorIndicadores = signal(false);

  constructor() {
    this.cargarIndicadores();
  }

  cambiarSeccion(id: SeccionFinanzas): void {
    this.egresoPendiente.set(false);
    this.seccion.set(id);
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
    this.datosCambiados.emit();
  }
}
