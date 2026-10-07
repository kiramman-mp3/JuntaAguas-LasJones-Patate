import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FinanzasService } from '../../../../../core/services/finanzas.service';
import { NotificationService } from '../../../../../core/services/notification.service';
import { ModalA11yDirective } from '../../../../../core/directives/modal-a11y.directive';
import { Egreso, numeroEgreso } from '../../../../../core/models/finanzas';
import { hoyEnEcuador } from '../../../../../core/utils/fechas';
import { FechaLocalPipe } from '../../../../../shared/pipes/fecha-local.pipe';

interface FormEgreso {
  fecha: string;
  concepto: string;
  proveedor: string;
  ruc_proveedor: string;
  numero_factura: string;
  valor: number | null;
  descripcion: string;
}

const formVacio = (): FormEgreso => ({
  fecha: hoyEnEcuador(), concepto: '', proveedor: '', ruc_proveedor: '', numero_factura: '', valor: null, descripcion: ''
});

/** Egresos de la Junta: compras, trabajos y pagos a proveedores. */
@Component({
  selector: 'app-egresos',
  standalone: true,
  imports: [FormsModule, FechaLocalPipe, ModalA11yDirective],
  templateUrl: './egresos.component.html'
})
export class EgresosComponent implements OnInit {
  private finanzas = inject(FinanzasService);
  private notify = inject(NotificationService);

  /** Abre el formulario de registro al mostrarse (atajo del dashboard). */
  readonly abrirNuevo = input(false);
  readonly registrado = output<void>();

  readonly hoy = hoyEnEcuador();
  readonly desde = signal(`${this.hoy.slice(0, 4)}-01-01`);
  readonly hasta = signal(this.hoy);
  readonly texto = signal('');
  readonly egresos = signal<Egreso[]>([]);
  readonly cargando = signal(false);
  readonly error = signal('');

  readonly formularioVisible = signal(false);
  readonly guardando = signal(false);
  readonly intentoGuardar = signal(false);
  form: FormEgreso = formVacio();

  readonly numeroEgreso = numeroEgreso;

  /** El RUC o cédula solo admite dígitos: se descartan letras y signos mientras se escribe. */
  soloDigitosRuc(evento: Event): void {
    const campo = evento.target as HTMLInputElement;
    const digitos = campo.value.replace(/\D/g, '').slice(0, 13);
    if (campo.value !== digitos) campo.value = digitos;
    this.form.ruc_proveedor = digitos;
  }

  readonly filtrados = computed(() => {
    const t = this.texto().trim().toLowerCase();
    if (!t) return this.egresos();
    return this.egresos().filter((e) =>
      [e.concepto, e.descripcion, e.proveedor_nombre, e.numero_factura, numeroEgreso(e.id), e.registrado_por_usuario]
        .some((campo) => String(campo ?? '').toLowerCase().includes(t)));
  });

  readonly total = computed(() => Math.round(this.filtrados().reduce((s, e) => s + Number(e.valor), 0) * 100) / 100);

  ngOnInit(): void {
    this.cargar();
    if (this.abrirNuevo()) this.abrirFormulario();
  }

  cargar(): void {
    if (this.desde() && this.hasta() && this.desde() > this.hasta()) {
      this.error.set('La fecha inicial debe ser anterior a la final.');
      return;
    }
    this.cargando.set(true);
    this.error.set('');
    this.finanzas.getEgresos({ desde: this.desde() || undefined, hasta: this.hasta() || undefined }).subscribe({
      next: (res) => {
        this.egresos.set(res.data.map((e) => ({ ...e, valor: Number(e.valor) })));
        this.cargando.set(false);
      },
      error: (err) => {
        this.cargando.set(false);
        this.error.set(err.error?.message || 'No se pudo cargar el historial de egresos.');
      }
    });
  }

  abrirFormulario(): void {
    this.form = formVacio();
    this.intentoGuardar.set(false);
    this.formularioVisible.set(true);
  }

  cerrarFormulario(): void {
    if (this.guardando()) return;
    this.formularioVisible.set(false);
  }

  /** Errores de validación por campo, con las mismas reglas que la API. */
  errores(): Partial<Record<keyof FormEgreso, string>> {
    const f = this.form;
    const errores: Partial<Record<keyof FormEgreso, string>> = {};
    if (!f.fecha) errores.fecha = 'Indique la fecha.';
    else if (f.fecha > this.hoy) errores.fecha = 'La fecha no puede ser futura.';
    if (f.concepto.trim().length < 3) errores.concepto = 'Describa el concepto (mínimo 3 caracteres).';
    const valor = Number(f.valor);
    if (f.valor === null || !Number.isFinite(valor) || valor <= 0) errores.valor = 'Ingrese un valor mayor a cero.';
    else if (Math.round(valor * 100) !== valor * 100) errores.valor = 'Use como máximo dos decimales.';
    if (f.ruc_proveedor.trim() && !/^\d{10}(\d{3})?$/.test(f.ruc_proveedor.trim())) errores.ruc_proveedor = 'El RUC o cédula debe tener 10 o 13 dígitos.';
    if (f.numero_factura.trim() && !/^[\d-]{1,30}$/.test(f.numero_factura.trim())) errores.numero_factura = 'Use solo dígitos y guiones (ej. 001-001-000012345).';
    return errores;
  }

  errorDe(campo: keyof FormEgreso): string {
    return this.intentoGuardar() ? this.errores()[campo] ?? '' : '';
  }

  guardar(): void {
    this.intentoGuardar.set(true);
    if (Object.keys(this.errores()).length || this.guardando()) return;
    const f = this.form;
    const opcional = (v: string) => v.trim() || undefined;
    this.guardando.set(true);
    this.finanzas.registrarEgreso({
      fecha: f.fecha,
      concepto: f.concepto.trim(),
      proveedor: opcional(f.proveedor),
      ruc_proveedor: opcional(f.ruc_proveedor),
      numero_factura: opcional(f.numero_factura),
      descripcion: opcional(f.descripcion),
      valor: Number(f.valor)
    }).subscribe({
      next: (res) => {
        this.guardando.set(false);
        this.formularioVisible.set(false);
        this.notify.success(res.message || 'Egreso registrado.');
        this.cargar();
        this.registrado.emit();
      },
      error: (err) => {
        this.guardando.set(false);
        this.notify.error(err.error?.message || 'No se pudo registrar el egreso.');
      }
    });
  }
}
