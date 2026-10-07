import {
  Component,
  OnInit,
  ChangeDetectorRef,
  Output,
  EventEmitter,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../../core/services/admin.service';
import { NotificationService } from '../../../../core/services/notification.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  selector: 'app-gestioncontratacion',
  styleUrl: './gestioncontratacion.scss',
  templateUrl: './gestioncontratacion.html',
})
export class Gestioncontratacion implements OnInit {
  @Output() dataChanged = new EventEmitter<void>();

  // Se conserva porque tu HTML utiliza esta condición.
  subTabFinanzas: 'EGRESOS' = 'EGRESOS';

  modalEgresoVisible = false;
  guardandoEgreso = false;

  historialEgresos: any[] = [];
  historialEgresosFiltroBusqueda = '';

  nuevoEgreso: {
    fecha: string;
    concepto: string;
    numero_factura: string;
    valor: number | null;
    descripcion: string;
  } = this.crearNuevoEgreso();

  constructor(
    private adminService: AdminService,
    private cdr: ChangeDetectorRef,
    private notify: NotificationService,
  ) {}

  ngOnInit(): void {
    this.cargarHistorialEgresos();
  }

  // Fecha local para el input de tipo date.
  private fechaActual(): string {
    const fecha = new Date();
    const anio = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');

    return `${anio}-${mes}-${dia}`;
  }

  private crearNuevoEgreso() {
    return {
      fecha: this.fechaActual(),
      concepto: '',
      numero_factura: '',
      valor: null as number | null,
      descripcion: '',
    };
  }

  // Formatos utilizados por la tabla.
  formatValor(valor: any): string {
    const numero = Number(valor ?? 0);
    return Number.isFinite(numero) ? numero.toFixed(2) : '0.00';
  }

  formatEgresoNo(id: any): string {
    return `EGR-${String(id ?? 0).padStart(6, '0')}`;
  }

  // Control del modal.
  abrirModalEgreso(): void {
    if (this.guardandoEgreso) return;

    this.nuevoEgreso = this.crearNuevoEgreso();
    this.modalEgresoVisible = true;
  }

  cerrarModalEgreso(): void {
    if (this.guardandoEgreso) return;

    this.modalEgresoVisible = false;
  }

  // Carga del historial.
  cargarHistorialEgresos(): void {
    this.adminService.getEgresos().subscribe({
      next: (res: any) => {
        this.historialEgresos = Array.isArray(res?.data)
          ? res.data
          : [];

        this.cdr.markForCheck();
      },
      error: (err: any) => {
        console.error('Error al consultar egresos:', err);
        this.notify.error(err?.error?.message || 'Error al consultar el historial de egresos.');
        this.cdr.markForCheck();
      },
    });
  }

  // Búsqueda del historial.
  get historialEgresosFiltrado(): any[] {
    const termino = this.historialEgresosFiltroBusqueda
      .trim()
      .toLowerCase();

    if (!termino) {
      return this.historialEgresos;
    }

    return this.historialEgresos.filter((egreso) => {
      const campos = [
        egreso.concepto,
        egreso.descripcion,
        egreso.proveedor_nombre,
        egreso.numero_factura,
        egreso.registrado_por_usuario,
        this.formatEgresoNo(egreso.id),
        `EGR-${egreso.id}`,
      ];

      return campos.some((campo) =>
        String(campo ?? '').toLowerCase().includes(termino),
      );
    });
  }

  // Registro de un egreso.
guardarEgreso(): void {
  if (this.guardandoEgreso) return;

  const concepto = this.nuevoEgreso.concepto.trim();
  const valor = Number(this.nuevoEgreso.valor);

  if (!this.nuevoEgreso.fecha) {
    this.notify.warning('Por favor selecciona la fecha del egreso.');
    return;
  }

  if (!concepto) {
    this.notify.warning('Por favor ingresa el concepto o motivo del egreso.');
    return;
  }

  if (!Number.isFinite(valor) || valor <= 0) {
    this.notify.warning('Por favor ingresa un monto válido mayor a cero.');
    return;
  }

  const payload = {
    fecha: this.nuevoEgreso.fecha,
    concepto,
    descripcion: this.nuevoEgreso.descripcion.trim() || undefined,
    numero_factura: this.nuevoEgreso.numero_factura.trim() || undefined,
    valor,
  };

  this.guardandoEgreso = true;

  this.adminService.registrarEgreso(payload).subscribe({
    next: (res: any) => {
      this.guardandoEgreso = false;
      this.modalEgresoVisible = false;

      this.cargarHistorialEgresos();
      this.dataChanged.emit();
      this.cdr.markForCheck();

      this.notify.success(res?.message || 'Egreso registrado exitosamente.');
    },
    error: (err: any) => {
      this.guardandoEgreso = false;
      this.cdr.markForCheck();

      this.notify.error(err?.error?.message || 'Error al registrar el egreso.');
    },
  });
}
}