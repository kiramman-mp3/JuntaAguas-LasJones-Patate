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
import { GRUPOS_FINANZAS, GrupoFinanzas, SeccionFinanzas } from './grupos-finanzas';

export type { GrupoFinanzas, GrupoSecciones, SeccionFinanzas } from './grupos-finanzas';

interface Indicadores {
  mes: Balance;
  historico: Balance;
}

@Component({
  selector: 'app-finanzas',
  standalone: true,
  imports: [PageHeaderComponent, CobroCajaComponent, HistorialPagosComponent, EgresosComponent, HistorialFinancieroComponent, FacturacionMensualComponent, TarifasComponent],
  templateUrl: './finanzas.component.html'
})
export class FinanzasComponent {
  private finanzas = inject(FinanzasService);
  private router = inject(Router);

  /** Dato de la ruta: qué apartado del menú se está mostrando. */
  readonly grupo = input<GrupoFinanzas | undefined>();
  /** Parámetro de ruta :seccion (texto libre de la URL; se valida en `seccionActual`). */
  readonly seccion = input<string | undefined>();
  /** Parámetro de consulta ?nuevo=egreso (atajo del dashboard). */
  readonly nuevo = input<string | undefined>();

  readonly grupos = GRUPOS_FINANZAS;

  readonly grupoActual = computed(() => this.grupos.find((g) => g.id === this.grupo()) ?? this.grupos[0]);

  /** Una sección desconocida (o de otro apartado) muestra la primera del apartado. */
  readonly seccionActual = computed<SeccionFinanzas>(() => {
    const secciones = this.grupoActual().secciones;
    return secciones.find((s) => s.id === this.seccion())?.id ?? secciones[0].id;
  });
  readonly indiceActual = computed(() => this.grupoActual().secciones.findIndex((s) => s.id === this.seccionActual()));
  readonly abrirEgreso = computed(() => this.seccionActual() === 'egresos' && this.nuevo() === 'egreso');

  readonly indicadores = signal<Indicadores | null>(null);
  readonly errorIndicadores = signal(false);

  constructor() {
    this.cargarIndicadores();
  }

  cambiarSeccion(id: SeccionFinanzas): void {
    this.router.navigate(['/admin', this.grupoActual().id, id]);
  }

  /** Flechas izquierda/derecha entre las secciones del apartado, como un grupo de pestañas. */
  onTeclaSegmento(evento: KeyboardEvent): void {
    if (evento.key !== 'ArrowRight' && evento.key !== 'ArrowLeft') return;
    evento.preventDefault();
    const secciones = this.grupoActual().secciones;
    const paso = evento.key === 'ArrowRight' ? 1 : -1;
    const siguiente = secciones[(this.indiceActual() + paso + secciones.length) % secciones.length];
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
