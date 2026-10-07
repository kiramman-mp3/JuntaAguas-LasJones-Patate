import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { FinanzasService } from '../../../../../core/services/finanzas.service';
import { NotificationService } from '../../../../../core/services/notification.service';
import { ModalA11yDirective } from '../../../../../core/directives/modal-a11y.directive';
import { ConceptoCobro, Tarifa } from '../../../../../core/models/finanzas';
import { hoyEnEcuador, sumarDias } from '../../../../../core/utils/fechas';
import { FechaLocalPipe } from '../../../../../shared/pipes/fecha-local.pipe';

interface FormTarifa {
  concepto_id: number | null;
  valor: number | null;
  vigencia_desde: string;
  observacion: string;
}

/** Primer día del mes siguiente: la fecha habitual para que rija una tarifa nueva. */
function inicioMesSiguiente(hoy: string): string {
  const [anio, mes] = hoy.split('-').map(Number);
  return mes === 12 ? `${anio + 1}-01-01` : `${anio}-${String(mes + 1).padStart(2, '0')}-01`;
}

/**
 * Tarifas por concepto de cobro, con su historial de vigencias.
 * Registrar una tarifa cierra la vigencia de la anterior el día previo (lo hace el servidor).
 */
@Component({
  selector: 'app-tarifas',
  standalone: true,
  imports: [FormsModule, FechaLocalPipe, ModalA11yDirective],
  templateUrl: './tarifas.component.html'
})
export class TarifasComponent {
  private finanzas = inject(FinanzasService);
  private notify = inject(NotificationService);

  readonly hoy = hoyEnEcuador();
  readonly conceptos = signal<ConceptoCobro[]>([]);
  readonly tarifas = signal<Tarifa[]>([]);
  readonly cargando = signal(false);
  readonly error = signal('');

  readonly formularioVisible = signal(false);
  readonly guardando = signal(false);
  readonly intentoGuardar = signal(false);
  form: FormTarifa = { concepto_id: null, valor: null, vigencia_desde: '', observacion: '' };

  /** Historial agrupado por concepto, del más reciente al más antiguo. */
  readonly historial = computed(() => this.conceptos().map((c) => ({
    concepto: c,
    tarifas: this.tarifas().filter((t) => t.concepto_id === c.id)
  })));

  constructor() {
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set('');
    forkJoin({ conceptos: this.finanzas.getConceptos(), tarifas: this.finanzas.getTarifas() }).subscribe({
      next: ({ conceptos, tarifas }) => {
        this.conceptos.set(conceptos.data.map((c) => ({ ...c, tarifa_actual: c.tarifa_actual === null ? null : Number(c.tarifa_actual) })));
        this.tarifas.set(tarifas.data.map((t) => ({ ...t, valor: Number(t.valor) })));
        this.cargando.set(false);
      },
      error: (err) => {
        this.cargando.set(false);
        this.error.set(err.error?.message || 'No se pudieron cargar las tarifas.');
      }
    });
  }

  /** Estado de una tarifa respecto de hoy. */
  estado(t: Tarifa): 'VIGENTE' | 'PROGRAMADA' | 'HISTORICA' {
    if (t.vigencia_desde > this.hoy) return 'PROGRAMADA';
    if (!t.vigencia_hasta || t.vigencia_hasta >= this.hoy) return 'VIGENTE';
    return 'HISTORICA';
  }

  /** Última fecha de inicio registrada de un concepto: la tarifa nueva debe empezar después. */
  private ultimoInicio(conceptoId: number | null): string | null {
    const fechas = this.tarifas().filter((t) => t.concepto_id === conceptoId).map((t) => t.vigencia_desde).sort();
    return fechas.length ? fechas[fechas.length - 1] : null;
  }

  abrirFormulario(concepto?: ConceptoCobro): void {
    const id = concepto?.id ?? this.conceptos()[0]?.id ?? null;
    this.form = { concepto_id: id, valor: concepto?.tarifa_actual ?? null, vigencia_desde: this.fechaSugerida(id), observacion: '' };
    this.intentoGuardar.set(false);
    this.formularioVisible.set(true);
  }

  onConcepto(id: number): void {
    this.form.concepto_id = Number(id);
    this.form.vigencia_desde = this.fechaSugerida(this.form.concepto_id);
  }

  private fechaSugerida(conceptoId: number | null): string {
    const sugerida = inicioMesSiguiente(this.hoy);
    const ultimo = this.ultimoInicio(conceptoId);
    return ultimo && ultimo >= sugerida ? sumarDias(ultimo, 1) : sugerida;
  }

  cerrarFormulario(): void {
    if (this.guardando()) return;
    this.formularioVisible.set(false);
  }

  errores(): Partial<Record<keyof FormTarifa, string>> {
    const f = this.form;
    const errores: Partial<Record<keyof FormTarifa, string>> = {};
    if (!f.concepto_id) errores.concepto_id = 'Elija el concepto.';
    const valor = Number(f.valor);
    if (f.valor === null || !Number.isFinite(valor) || valor <= 0) errores.valor = 'Ingrese un valor mayor a cero.';
    else if (Math.round(valor * 100) !== valor * 100) errores.valor = 'Use como máximo dos decimales.';
    if (!f.vigencia_desde) errores.vigencia_desde = 'Indique desde cuándo rige.';
    else {
      const ultimo = this.ultimoInicio(f.concepto_id);
      if (ultimo && f.vigencia_desde <= ultimo) errores.vigencia_desde = `Debe ser posterior al ${ultimo}, inicio de la última tarifa.`;
    }
    return errores;
  }

  errorDe(campo: keyof FormTarifa): string {
    return this.intentoGuardar() ? this.errores()[campo] ?? '' : '';
  }

  /** Nombre del concepto elegido en el formulario. */
  conceptoElegido(): ConceptoCobro | undefined {
    return this.conceptos().find((c) => c.id === this.form.concepto_id);
  }

  guardar(): void {
    this.intentoGuardar.set(true);
    if (Object.keys(this.errores()).length || this.guardando()) return;
    this.guardando.set(true);
    this.finanzas.registrarTarifa({
      concepto_id: this.form.concepto_id!,
      valor: Number(this.form.valor),
      vigencia_desde: this.form.vigencia_desde,
      observacion: this.form.observacion.trim() || undefined
    }).subscribe({
      next: (res) => {
        this.guardando.set(false);
        this.formularioVisible.set(false);
        this.notify.success(res.message || 'Tarifa registrada.');
        this.cargar();
      },
      error: (err) => {
        this.guardando.set(false);
        this.notify.error(err.error?.message || 'No se pudo registrar la tarifa.');
      }
    });
  }
}
