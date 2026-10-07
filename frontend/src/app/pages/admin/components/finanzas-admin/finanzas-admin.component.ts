import { Component, OnInit, ChangeDetectorRef, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../../../core/services/admin.service';
import { ModalA11yDirective } from '../../../../core/directives/modal-a11y.directive';
import { NotificationService } from '../../../../core/services/notification.service';
import { DialogService } from '../../../../core/services/dialog.service';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

@Component({
  selector: 'app-finanzas-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalA11yDirective],
  templateUrl: './finanzas-admin.component.html',
  styleUrls: ['./finanzas-admin.component.scss']
})
export class FinanzasAdminComponent implements OnInit {
  // KPIs propios — se cargan internamente
  kpis: any = { recaudadoMes: 0, egresosMes: 0, balanceAlDia: 0, pendientesCobro: 0 };
  resumenMensual: any[] = [];
  @Output() dataChanged = new EventEmitter<void>();

  // Lógica Finanzas
  Number = Number;
  subTabFinanzas: 'INGRESOS' | 'EGRESOS' = 'INGRESOS';
  modalCobroVisible: boolean = false;
  todosLosComunerosFinanzas: any[] = [];
  comuneroFiltroFinanzas: string = '';
  comuneroSeleccionadoFinanzas: any = null;
  obligacionesComunero: any[] = [];
  obligacionesSeleccionadasIds: number[] = [];
  valorRecibidoFinanzas: number | null = null;
  observacionCobro: string = '';
  comprobanteModalVisible: boolean = false;
  comprobanteActual: any = null;
  historialPagos: any[] = [];
  historialFiltroBusqueda: string = '';
  pagosComunero: any[] = [];

  // Lógica de Egresos
  modalEgresoVisible: boolean = false;
  historialEgresos: any[] = [];
  historialEgresosFiltroBusqueda: string = '';
  nuevoEgreso: any = {
    fecha: new Date().toISOString().substring(0, 10),
    concepto: '',
    proveedor: '',
    ruc: '',
    numero_factura: '',
    valor: null,
    descripcion: ''
  };

  constructor(
    private adminService: AdminService,
    private cdr: ChangeDetectorRef,
    private notify: NotificationService,
    private dialog: DialogService
  ) {}

  ngOnInit() {
    this.cargarKpis();
    this.cargarComunerosFinanzas();
    this.cargarHistorialPagos();
    this.cargarHistorialEgresos();
  }

  cargarKpis() {
    this.adminService.getBalance().subscribe({
      next: (res: any) => {
        if (res && res.balance) {
          this.kpis.recaudadoMes   = Number(res.balance.totalIngresos)   || 0;
          this.kpis.egresosMes     = Number(res.balance.totalEgresos)    || 0;
          this.kpis.pendientesCobro = Number(res.balance.totalPendientes) || 0;
          this.kpis.balanceAlDia   = Number(res.balance.balanceAlDia)    || 0;
        }
        if (res && res.resumenMensual) {
          this.resumenMensual = res.resumenMensual;
        }
        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }

  // --- MÉTODOS DE FORMATO ---
  formatValor(val: any): string {
    return Number(val || 0).toFixed(2);
  }

  formatReciboNo(id: any): string {
    return `REC-${String(id || 0).padStart(6, '0')}`;
  }

  formatEgresoNo(id: any): string {
    return `EGR-${String(id || 0).padStart(6, '0')}`;
  }

  // --- CONTROL DE TABS Y MODALES ---
  cambiarSubTabFinanzas(tab: 'INGRESOS' | 'EGRESOS') {
    this.subTabFinanzas = tab;
  }

  prepararNuevoCobro() {
    this.cambiarSubTabFinanzas('INGRESOS');
    this.comuneroFiltroFinanzas = '';
    this.comuneroSeleccionadoFinanzas = null;
    this.obligacionesComunero = [];
    this.pagosComunero = [];
    this.obligacionesSeleccionadasIds = [];
    this.valorRecibidoFinanzas = null;
    this.cargarComunerosFinanzas();
  }

  cerrarModalCobro() {
    this.comuneroSeleccionadoFinanzas = null;
  }

  abrirModalEgreso() {
    this.modalEgresoVisible = true;
    this.nuevoEgreso = {
      fecha: new Date().toISOString().substring(0, 10),
      concepto: '',
      proveedor: '',
      ruc: '',
      numero_factura: '',
      valor: null,
      descripcion: ''
    };
    this.cdr.detectChanges();
  }

  cerrarModalEgreso() {
    this.modalEgresoVisible = false;
    this.cdr.detectChanges();
  }

  // --- CARGA DE DATOS ---
  cargarComunerosFinanzas() {
    this.adminService.getPersonas(1, 1000).subscribe({
      next: (res) => {
        if (res && res.data) {
          this.todosLosComunerosFinanzas = res.data;
          this.cdr.detectChanges();
        }
      },
      error: () => {}
    });
  }

  cargarHistorialPagos() {
    this.adminService.getPagos().subscribe({
      next: (res) => {
        if (res && res.data) {
          this.historialPagos = res.data;
          this.cdr.detectChanges();
        }
      },
      error: () => {}
    });
  }

  cargarHistorialEgresos() {
    this.adminService.getEgresos().subscribe({
      next: (res) => {
        if (res && res.data) {
          this.historialEgresos = res.data;
          this.cdr.detectChanges();
        }
      },
      error: () => {}
    });
  }

  // --- OBLIGACIONES Y SELECCIÓN ---
  seleccionarComuneroFinanzas(comunero: any) {
    this.comuneroSeleccionadoFinanzas = comunero;
    this.obligacionesComunero = [];
    this.pagosComunero = [];
    this.obligacionesSeleccionadasIds = [];
    this.valorRecibidoFinanzas = null;
    this.cdr.detectChanges();

    if (!comunero) return;

    this.adminService.getObligaciones(comunero.id).subscribe({
      next: (res) => {
        if (res && res.data) {
          this.obligacionesComunero = res.data.filter((o: any) => o.estado === 'PENDIENTE');
          this.pagosComunero = res.data.filter((o: any) => o.estado === 'PAGADA');
          this.obligacionesSeleccionadasIds = this.obligacionesComunero.map(o => o.id);
        } else {
          this.obligacionesComunero = [];
          this.pagosComunero = [];
          this.obligacionesSeleccionadasIds = [];
        }
        this.cdr.detectChanges();
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error al consultar obligaciones', err);
        this.notify.error('Error al consultar obligaciones del comunero.');
        this.cdr.detectChanges();
      }
    });
  }

  isObligacionSeleccionada(id: number): boolean {
    return this.obligacionesSeleccionadasIds.includes(id);
  }

  toggleObligacionSeleccionada(id: number) {
    if (this.isObligacionSeleccionada(id)) {
      this.obligacionesSeleccionadasIds = this.obligacionesSeleccionadasIds.filter(item => item !== id);
    } else {
      this.obligacionesSeleccionadasIds = [...this.obligacionesSeleccionadasIds, id];
    }
    this.cdr.detectChanges();
  }

  toggleSeleccionarTodasObligaciones(event: any) {
    if (event.target.checked) {
      this.obligacionesSeleccionadasIds = this.obligacionesComunero.map(o => o.id);
    } else {
      this.obligacionesSeleccionadasIds = [];
    }
    this.cdr.detectChanges();
  }

  // --- FILTROS ---
  get historialEgresosFiltrado(): any[] {
    if (!this.historialEgresosFiltroBusqueda.trim()) {
      return this.historialEgresos;
    }
    const term = this.historialEgresosFiltroBusqueda.toLowerCase();
    return this.historialEgresos.filter(e =>
      (e.concepto && e.concepto.toLowerCase().includes(term)) ||
      (e.proveedor_nombre && e.proveedor_nombre.toLowerCase().includes(term)) ||
      (e.numero_factura && e.numero_factura.toLowerCase().includes(term)) ||
      (e.registrado_por_usuario && e.registrado_por_usuario.toLowerCase().includes(term)) ||
      (e.id && `egr-${e.id}`.toLowerCase().includes(term))
    );
  }

  get comunerosFiltradosFinanzas(): any[] {
    const lista = this.todosLosComunerosFinanzas;
    if (!this.comuneroFiltroFinanzas.trim()) {
      return lista;
    }
    const term = this.comuneroFiltroFinanzas.toLowerCase();
    return lista.filter((u: any) =>
      (u.nombres && u.nombres.toLowerCase().includes(term)) ||
      (u.apellidos && u.apellidos.toLowerCase().includes(term)) ||
      (u.cedula && u.cedula.toLowerCase().includes(term))
    );
  }

  get historialPagosFiltrado(): any[] {
    if (!this.historialFiltroBusqueda.trim()) {
      return this.historialPagos;
    }
    const term = this.historialFiltroBusqueda.toLowerCase();
    return this.historialPagos.filter(p =>
      (p.comunero_nombre && p.comunero_nombre.toLowerCase().includes(term)) ||
      (p.cedula && p.cedula.toLowerCase().includes(term)) ||
      (p.id && `rec-${p.id}`.toLowerCase().includes(term)) ||
      (p.registrado_por_usuario && p.registrado_por_usuario.toLowerCase().includes(term))
    );
  }

  // --- CALCULADORA ---
  get totalAPagarFinanzas(): number {
    return this.obligacionesComunero
      .filter(o => this.obligacionesSeleccionadasIds.includes(o.id))
      .reduce((sum, o) => sum + Number(o.valor || 0), 0);
  }

  get cambioCalculado(): number {
    if (!this.valorRecibidoFinanzas || this.valorRecibidoFinanzas < this.totalAPagarFinanzas) {
      return 0;
    }
    return Number((this.valorRecibidoFinanzas - this.totalAPagarFinanzas).toFixed(2));
  }

  // --- ACCIONES ---
  guardarEgreso() {
    if (!this.nuevoEgreso.concepto || !this.nuevoEgreso.concepto.trim()) {
      this.notify.warning('Por favor ingresa el concepto o motivo del egreso.');
      return;
    }
    if (!this.nuevoEgreso.valor || Number(this.nuevoEgreso.valor) <= 0) {
      this.notify.warning('Por favor ingresa un monto válido mayor a cero.');
      return;
    }

    const payload = {
      fecha: this.nuevoEgreso.fecha || new Date().toISOString().substring(0, 10),
      concepto: this.nuevoEgreso.concepto.trim(),
      descripcion: this.nuevoEgreso.descripcion ? this.nuevoEgreso.descripcion.trim() : null,
      numero_factura: this.nuevoEgreso.numero_factura ? this.nuevoEgreso.numero_factura.trim() : null,
      valor: Number(this.nuevoEgreso.valor)
    };

    this.adminService.registrarEgreso(payload).subscribe({
      next: (res: any) => {
        this.modalEgresoVisible = false;
        this.cdr.detectChanges();
        this.cargarHistorialEgresos();
        this.dataChanged.emit();
        this.notify.success(res.message || 'Egreso registrado exitosamente.');
      },
      error: (err) => this.notify.error(err.error?.message || 'Error al registrar el egreso.')
    });
  }

  cobrarObligacion() {
    if (!this.comuneroSeleccionadoFinanzas || this.obligacionesSeleccionadasIds.length === 0) {
      this.notify.warning('Por favor selecciona al menos una obligación a cobrar.');
      return;
    }

    const total = this.totalAPagarFinanzas;
    if (this.valorRecibidoFinanzas === null || this.valorRecibidoFinanzas < total) {
      this.notify.warning(`El valor recibido debe ser mayor o igual al total a pagar ($${total.toFixed(2)}).`);
      return;
    }

    const obligacionesACobrar = this.obligacionesComunero.filter(o => this.obligacionesSeleccionadasIds.includes(o.id));
    const textoObs = this.observacionCobro?.trim() || 'Pago procesado desde panel administrativo.';

    const payload = {
      persona_id: this.comuneroSeleccionadoFinanzas.id,
      metodo: 'EFECTIVO',
      obligacionesIds: this.obligacionesSeleccionadasIds,
      observacion: textoObs,
      observaciones: textoObs
    };

    this.adminService.registrarPago(payload).subscribe({
      next: (res: any) => {
        // Armar datos del comprobante para imprimir
        this.comprobanteActual = {
          comprobanteNo: res.pagoId ? `REC-${String(res.pagoId).padStart(6, '0')}` : `REC-${Date.now()}`,
          fechaHora: new Date().toLocaleString(),
          comuneroNombre: this.comuneroSeleccionadoFinanzas.nombres,
          comuneroCedula: this.comuneroSeleccionadoFinanzas.cedula,
          detalles: obligacionesACobrar.map(o => ({
            concepto: o.concepto_nombre || o.concepto || 'Cobro de Rubro',
            periodo: o.periodo_anio ? `${o.periodo_anio}${o.periodo_mes ? ' - Mes ' + o.periodo_mes : ''}` : 'N/A',
            valor: Number(o.valor)
          })),
          total: total,
          valorRecibido: Number(this.valorRecibidoFinanzas),
          cambio: this.cambioCalculado,
          observacion: textoObs
        };

        this.observacionCobro = '';
        this.comprobanteModalVisible = true;
        this.modalCobroVisible = false;
        this.dataChanged.emit();
        this.cargarHistorialPagos();
        this.seleccionarComuneroFinanzas(this.comuneroSeleccionadoFinanzas);
      },
      error: (err) => this.notify.error(err.error?.message || 'Error al procesar el pago.')
    });
  }

  async anularPagoDesdeHistorial(pago: any) {
    if (pago.estado === 'ANULADO') {
      this.notify.info('Este pago ya se encuentra anulado.');
      return;
    }

    const motivo = await this.dialog.solicitar({
      titulo: 'Anular pago',
      mensaje: `Ingresa el motivo de anulación para el pago No. REC-${String(pago.id).padStart(6, '0')}:`,
      placeholder: 'Motivo de la anulación',
      textoConfirmar: 'Anular pago',
      tipo: 'DANGER'
    });
    if (!motivo || !motivo.trim()) return;

    this.adminService.anularPago(pago.id, motivo.trim()).subscribe({
      next: (res: any) => {
        this.notify.success(res.message || 'Pago anulado exitosamente.');
        this.dataChanged.emit();
        this.cargarHistorialPagos();
        if (this.comuneroSeleccionadoFinanzas) {
          this.seleccionarComuneroFinanzas(this.comuneroSeleccionadoFinanzas);
        }
      },
      error: (err) => this.notify.error(err.error?.message || 'Error al anular el pago.')
    });
  }

  reimprimirPDFDesdeHistorial(pago: any) {
    this.comprobanteActual = {
      comprobanteNo: `REC-${String(pago.id).padStart(6, '0')}`,
      fechaHora: new Date(pago.fecha_pago).toLocaleString(),
      comuneroNombre: pago.comunero_nombre,
      comuneroCedula: pago.cedula,
      detalles: [
        {
          concepto: 'Cobro de Rubro / Obligación',
          periodo: 'Registrado',
          valor: Number(pago.valor_total)
        }
      ],
      total: Number(pago.valor_total),
      valorRecibido: Number(pago.valor_total),
      cambio: 0
    };
    this.imprimirPDFComprobante();
  }

  cerrarModalComprobante() {
    this.comprobanteModalVisible = false;
    this.comprobanteActual = null;
  }

  imprimirPDFComprobante() {
    if (!this.comprobanteActual) return;
    const c = this.comprobanteActual;

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a5'
    });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(0, 0, 0);
    doc.text('JUNTA DE AGUA Y RIEGO "LA JONES"', 74, 15, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    doc.text('Patate - Tungurahua - Ecuador', 74, 20, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text(`COMPROBANTE DE PAGO ${c.comprobanteNo}`, 74, 27, { align: 'center' });

    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.4);
    doc.line(15, 30, 133, 30);

    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.text('Comunero Titular:', 15, 36);
    doc.setFont('helvetica', 'normal');
    doc.text(c.comuneroNombre, 45, 36);

    doc.setFont('helvetica', 'bold');
    doc.text('Cédula / RUC:', 15, 42);
    doc.setFont('helvetica', 'normal');
    doc.text(c.comuneroCedula, 45, 42);

    doc.setFont('helvetica', 'bold');
    doc.text('Fecha / Hora:', 15, 48);
    doc.setFont('helvetica', 'normal');
    doc.text(c.fechaHora, 45, 48);

    const tableData = c.detalles.map((d: any) => [
      d.concepto,
      d.periodo,
      `$${d.valor.toFixed(2)}`
    ]);

    autoTable(doc, {
      startY: 53,
      head: [['Concepto', 'Periodo', 'Valor']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 9, lineColor: [0, 0, 0], lineWidth: 0.2 },
      bodyStyles: { textColor: [0, 0, 0], fontSize: 8.5, lineColor: [200, 200, 200], lineWidth: 0.1 },
      columnStyles: {
        0: { cellWidth: 60 },
        1: { cellWidth: 35 },
        2: { cellWidth: 23, halign: 'right' }
      },
      margin: { left: 15, right: 15 }
    });

    const finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 8 : 100;

    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);

    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL COBRADO:', 75, finalY);
    doc.text(`$${c.total.toFixed(2)}`, 133, finalY, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.text('VALOR RECIBIDO:', 75, finalY + 5);
    doc.text(`$${c.valorRecibido.toFixed(2)}`, 133, finalY + 5, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.text('CAMBIO ENTREGADO:', 75, finalY + 10);
    doc.text(`$${c.cambio.toFixed(2)}`, 133, finalY + 10, { align: 'right' });

    if (c.observacion) {
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text(`Obs: ${c.observacion}`, 15, finalY + 16, { maxWidth: 118 });
    }

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(80, 80, 80);
    doc.text('Gracias por mantener al día sus aportes para el fortalecimiento de nuestra Junta de Agua.', 74, finalY + 23, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('CAJA GENERAL - JUNTA LA JONES', 74, finalY + 28, { align: 'center' });

    doc.autoPrint();
    const pdfBlobUrl = doc.output('bloburl');
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.src = pdfBlobUrl.toString();
    document.body.appendChild(iframe);
    iframe.onload = () => {
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      }, 100);
    };
  }
}
