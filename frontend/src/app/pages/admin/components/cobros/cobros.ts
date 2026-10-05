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

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

@Component({
  selector: 'app-cobros',
  standalone: true,
  imports: [CommonModule, FormsModule],
  styleUrl: './cobros.scss',
  templateUrl: './cobros.html',
})
export class Cobros implements OnInit {
  @Output() dataChanged = new EventEmitter<void>();

  todosLosComunerosFinanzas: any[] = [];
  comuneroFiltroFinanzas = '';
  comuneroSeleccionadoFinanzas: any = null;

  obligacionesComunero: any[] = [];
  pagosComunero: any[] = [];
  obligacionesSeleccionadasIds: number[] = [];

  valorRecibidoFinanzas: number | null = null;

  cargandoObligaciones = false;
  procesandoPago = false;
  
  listaPeriodos: any[] = [];
  periodoSeleccionadoFinanzas: any = null; // <-- PROPIEDAD AGREGADA AQUÍ

  // Permite descartar respuestas de una selección anterior.
  private consultaObligaciones = 0;

  constructor(
    private adminService: AdminService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.cargarComunerosFinanzas();
    this.cargarPeriodosObligaciones();
  }

  cargarComunerosFinanzas(): void {
    this.adminService.getPersonas(1, 1000).subscribe({
      next: (res: any) => {
        this.todosLosComunerosFinanzas = res?.data ?? [];
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error('Error al cargar comuneros', err);
        alert('No se pudo cargar la lista de comuneros.');
      },
    });
  }

  cargarPeriodosObligaciones(): void {
    this.adminService.getPeriodosObligaciones().subscribe({
      next: (res: any) => {
        this.listaPeriodos = res?.data ?? [];
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        console.error('Error al cargar periodos de obligaciones', err);
      },
    });
  }

  get comunerosFiltradosFinanzas(): any[] {
    const termino = this.comuneroFiltroFinanzas.trim().toLowerCase();

    if (!termino) {
      return this.todosLosComunerosFinanzas;
    }

    return this.todosLosComunerosFinanzas.filter((comunero) =>
      [
        comunero.nombres,
        comunero.apellidos,
        comunero.cedula,
      ].some((valor) =>
        String(valor ?? '').toLowerCase().includes(termino),
      ),
    );
  }

  // MODIFICAR ESTE MÉTODO PARA ENVIAR EL AÑO SELECCIONADO
seleccionarComuneroFinanzas(comunero: any): void {
    if (this.procesandoPago) return;

    // VALIDACIÓN: Si no hay año seleccionado, no hace nada (el panel derecho muestra el aviso)
    if (!this.periodoSeleccionadoFinanzas) {
      return;
    }

    this.comuneroSeleccionadoFinanzas = comunero;
    this.obligacionesComunero = [];
    this.pagosComunero = [];
    this.obligacionesSeleccionadasIds = [];
    this.valorRecibidoFinanzas = null;

    const consultaActual = ++this.consultaObligaciones;

    if (!comunero) {
      this.cargandoObligaciones = false;
      return;
    }

    this.cargandoObligaciones = true;

    this.adminService.getObligaciones(comunero.id, this.periodoSeleccionadoFinanzas).subscribe({
      next: (res: any) => {
        if (consultaActual !== this.consultaObligaciones) return;

        const obligaciones: any[] = res?.data ?? [];

        this.obligacionesComunero = obligaciones.filter(
          (ob) => ob.estado === 'PENDIENTE',
        );

        this.pagosComunero = obligaciones.filter(
          (ob) => ob.estado === 'PAGADA',
        );

        this.obligacionesSeleccionadasIds =
          this.obligacionesComunero.map((ob) => ob.id);

        this.cargandoObligaciones = false;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        if (consultaActual !== this.consultaObligaciones) return;

        this.cargandoObligaciones = false;
        console.error('Error al consultar obligaciones', err);
        this.cdr.detectChanges();
      },
    });
  }

  onCambioPeriodo(): void {
    if (this.comuneroSeleccionadoFinanzas) {
      this.seleccionarComuneroFinanzas(this.comuneroSeleccionadoFinanzas);
    }
  }

  isObligacionSeleccionada(id: number): boolean {
    return this.obligacionesSeleccionadasIds.includes(id);
  }

  toggleObligacionSeleccionada(id: number): void {
    if (this.procesandoPago) return;

    if (this.isObligacionSeleccionada(id)) {
      this.obligacionesSeleccionadasIds =
        this.obligacionesSeleccionadasIds.filter(
          (seleccionadoId) => seleccionadoId !== id,
        );
    } else {
      this.obligacionesSeleccionadasIds = [
        ...this.obligacionesSeleccionadasIds,
        id,
      ];
    }
  }

  toggleSeleccionarTodasObligaciones(event: Event): void {
    if (this.procesandoPago) return;

    const seleccionado =
      (event.target as HTMLInputElement).checked;

    this.obligacionesSeleccionadasIds = seleccionado
      ? this.obligacionesComunero.map((ob) => ob.id)
      : [];
  }

  formatValor(valor: unknown): string {
    const numero = Number(valor ?? 0);
    return Number.isFinite(numero) ? numero.toFixed(2) : '0.00';
  }

  get totalAPagarFinanzas(): number {
    const total = this.obligacionesComunero
      .filter((ob) => this.isObligacionSeleccionada(ob.id))
      .reduce((suma, ob) => suma + Number(ob.valor ?? 0), 0);

    return Number(total.toFixed(2));
  }

  get cambioCalculado(): number {
    const recibido = this.valorRecibidoFinanzas;
    const total = this.totalAPagarFinanzas;

    if (
      recibido === null ||
      !Number.isFinite(recibido) ||
      recibido < total
    ) {
      return 0;
    }

    return Number((recibido - total).toFixed(2));
  }

  cobrarObligacion(): void {
    if (this.procesandoPago || this.cargandoObligaciones) return;

    if (
      !this.comuneroSeleccionadoFinanzas ||
      this.obligacionesSeleccionadasIds.length === 0
    ) {
      alert('Selecciona al menos una obligación para cobrar.');
      return;
    }

    const total = this.totalAPagarFinanzas;
    const recibido = this.valorRecibidoFinanzas;

    if (
      !Number.isFinite(total) ||
      total <= 0 ||
      recibido === null ||
      !Number.isFinite(recibido) ||
      recibido < total
    ) {
      alert('Ingresa un valor recibido válido que cubra el total.');
      return;
    }

    // Captura los datos antes de iniciar la petición.
    const comunero = { ...this.comuneroSeleccionadoFinanzas };
    const ids = [...this.obligacionesSeleccionadasIds];

    const detalles = this.obligacionesComunero
      .filter((ob) => ids.includes(ob.id))
      .map((ob) => ({
        concepto:
          ob.concepto_nombre || ob.concepto || 'Cobro de Rubro',
        periodo: ob.periodo_anio
          ? `${ob.periodo_anio}${
              ob.periodo_mes ? ' - Mes ' + ob.periodo_mes : ''
            }`
          : 'N/A',
        valor: Number(ob.valor),
      }));

    const payload = {
      persona_id: comunero.id,
      metodo: 'EFECTIVO',
      obligacionesIds: ids,
      observaciones: 'Pago procesado desde panel administrativo.',
    };

    this.procesandoPago = true;

    this.adminService.registrarPago(payload).subscribe({
      next: (res: any) => {
        this.procesandoPago = false;

        const comprobante = {
          comprobanteNo: res.pagoId
            ? `REC-${String(res.pagoId).padStart(6, '0')}`
            : `REC-${Date.now()}`,
          fechaHora: new Date().toLocaleString('es-EC'),
          comuneroNombre: String(comunero.nombres ?? ''),
          comuneroCedula: String(comunero.cedula ?? ''),
          detalles,
          total,
          valorRecibido: recibido,
          cambio: Number((recibido - total).toFixed(2)),
        };

        this.seleccionarComuneroFinanzas(comunero);
        this.dataChanged.emit();

        try {
          this.generarPDFComprobante(comprobante);
        } catch (error) {
          console.error('Error al generar el comprobante', error);
          alert(
            'El pago fue registrado, pero no se pudo generar el PDF. ' +
            'No vuelvas a registrar el pago.',
          );
        }

        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.procesandoPago = false;
        alert(err.error?.message || 'Error al procesar el pago.');
        this.cdr.detectChanges();
      },
    });
  }

  private generarPDFComprobante(comprobante: any): void {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a5',
    });

    const centro = doc.internal.pageSize.getWidth() / 2;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(
      'JUNTA DE AGUA Y RIEGO "LA JONES"',
      centro,
      15,
      { align: 'center' },
    );

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(
      'Patate - Tungurahua - Ecuador',
      centro,
      21,
      { align: 'center' },
    );

    doc.setFont('helvetica', 'bold');
    doc.text(
      `COMPROBANTE DE PAGO ${comprobante.comprobanteNo}`,
      centro,
      28,
      { align: 'center' },
    );

    doc.line(15, 32, 133, 32);

    doc.setFont('helvetica', 'normal');

    const nombre = doc.splitTextToSize(
      `Comunero: ${comprobante.comuneroNombre}`,
      118,
    );
    doc.text(nombre, 15, 39);

    const siguienteY = 39 + nombre.length * 5;
    doc.text(`Cédula: ${comprobante.comuneroCedula}`, 15, siguienteY);
    doc.text(`Fecha: ${comprobante.fechaHora}`, 15, siguienteY + 6);

    autoTable(doc, {
      startY: siguienteY + 12,
      head: [['Concepto', 'Periodo', 'Valor']],
      body: comprobante.detalles.map((detalle: any) => [
        detalle.concepto,
        detalle.periodo,
        `$${detalle.valor.toFixed(2)}`,
      ]),
      foot: [
        ['TOTAL COBRADO', '', `$${comprobante.total.toFixed(2)}`],
        ['VALOR RECIBIDO', '', `$${comprobante.valorRecibido.toFixed(2)}`],
        ['CAMBIO ENTREGADO', '', `$${comprobante.cambio.toFixed(2)}`],
      ],
      showFoot: 'lastPage',
      theme: 'grid',
      margin: { left: 15, right: 15 },
      styles: { fontSize: 8 },
      headStyles: {
        fillColor: [240, 240, 240],
        textColor: [0, 0, 0],
      },
      footStyles: {
        fillColor: [240, 240, 240],
        textColor: [0, 0, 0],
      },
      columnStyles: {
        0: { cellWidth: 60 },
        1: { cellWidth: 35 },
        2: { cellWidth: 23, halign: 'right' },
      },
    });

    doc.save(`${comprobante.comprobanteNo}.pdf`);
  }
}