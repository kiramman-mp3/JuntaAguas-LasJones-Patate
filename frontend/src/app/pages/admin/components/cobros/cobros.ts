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
  comuneroSeleccionadoFinanzas: any = null;
  obligacionesComunero: any[] = [];
  obligacionesSeleccionadasIds: number[] = [];
  valorRecibidoFinanzas: number | null = null;
  cargandoObligaciones = false;
  procesandoPago = false;
  listaPeriodos: any[] = [];
  periodoSeleccionadoFinanzas: number | null = null;
  anioFinancieroFiltro: number | null = null;
  busquedaFinanciera = '';
  tipoObligacionSeleccionado: 'MENSUALIDAD' | 'MULTA' = 'MENSUALIDAD';
  tabFinancieroActivo: 'MENSUALIDAD' | 'MULTA' | 'ERROR' |'BIENVENIDA'= 'BIENVENIDA';
  mensajeErrorFinanciero = 'Seleccione un año e ingrese una cédula de 10 dígitos.';
  private consultaListado = 0;

  constructor(private adminService: AdminService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.adminService.getPeriodosObligaciones().subscribe({
      next: (res: any) => {
        this.listaPeriodos = this.extraerLista(res);
        this.cdr.detectChanges();
      },
      error: () => {
        this.mostrarErrorFinanciero('No se pudieron cargar los años disponibles.');
        this.cdr.detectChanges();
      },
    });
  }

  private extraerLista(res: any): any[] {
    const datos = res?.data ?? res;
    return Array.isArray(datos) ? datos : [];
  }

  private limpiarConsulta(): void {
    ++this.consultaListado;
    this.cargandoObligaciones = false;
    this.comuneroSeleccionadoFinanzas = null;
    this.obligacionesComunero = [];
    this.obligacionesSeleccionadasIds = [];
    this.valorRecibidoFinanzas = null;
    this.periodoSeleccionadoFinanzas = null;
  }

  private mostrarErrorFinanciero(mensaje: string): void {
    this.limpiarConsulta();
    this.mensajeErrorFinanciero = mensaje;
    this.tabFinancieroActivo = 'BIENVENIDA';
  }

  get cedulaBusquedaInvalida(): boolean {
    const valor = this.busquedaFinanciera.trim();
    return valor.length > 0 && !/^\d{10}$/.test(valor);
  }

  get ayudaCedulaBusqueda(): string {
    const valor = this.busquedaFinanciera.trim();

    if (!valor) return 'Debe ingresar 10 dígitos.';
    if (/^\d+$/.test(valor) && valor.length < 10) {
      return `Faltan ${10 - valor.length} dígitos.`;
    }
    if (/^\d+$/.test(valor) && valor.length === 10) return 'Cédula válida.';
    return 'Solo se permiten números.';
  }

  normalizarCedulaInput(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    if (!input) return;

    const valorNormalizado = input.value.replace(/\D/g, '').slice(0, 10);
    if (input.value !== valorNormalizado) {
      input.value = valorNormalizado;
    }

    this.busquedaFinanciera = valorNormalizado;
    this.onCambioFiltros();
  }

  private validarFiltros(): string {
    const anio = Number(this.anioFinancieroFiltro);
    if (!Number.isInteger(anio) || anio <= 0) return 'Seleccione un año para consultar las obligaciones.';
    if (!/^\d{10}$/.test(this.busquedaFinanciera.trim())) return 'La cédula debe contener exactamente 10 dígitos.';
    return '';
  }

  onCambioFiltros(): void {
    if (this.procesandoPago) return;
    this.limpiarConsulta();
    const error = this.validarFiltros();
    this.mensajeErrorFinanciero = error;
    this.tabFinancieroActivo = error ? 'ERROR' : this.tipoObligacionSeleccionado;
  }

  cambiarTabFinanciero(tab: 'MENSUALIDAD' | 'MULTA'): void {
    if (this.procesandoPago || this.cargandoObligaciones) return;
    this.tipoObligacionSeleccionado = tab;
    this.onCambioFiltros();
  }

  // Este método solo está conectado al botón Buscar.
  cargarObligacionesSegunTab(): void {
    if (this.procesandoPago || this.cargandoObligaciones) return;
    const error = this.validarFiltros();
    if (error) {
      this.mostrarErrorFinanciero(error);
      return;
    }
    const cedula = this.busquedaFinanciera.trim();
    const anio = Number(this.anioFinancieroFiltro);
    const tab = this.tipoObligacionSeleccionado;
    this.limpiarConsulta();
    const consulta = this.consultaListado;
    this.periodoSeleccionadoFinanzas = anio;
    this.tabFinancieroActivo = tab;
    this.mensajeErrorFinanciero = '';
    this.cargandoObligaciones = true;
    const peticion = tab === 'MENSUALIDAD'
      ? this.adminService.getObligacionesMensualidades(cedula, anio)
      : this.adminService.getObligacionesMultas(cedula, anio);
    peticion.subscribe({
      next: (res: any) => {
        if (consulta !== this.consultaListado) return;
        this.cargandoObligaciones = false;
        if (res?.status && res.status !== 'OK') {
          this.mostrarErrorFinanciero(res.message || 'No se pudieron consultar las obligaciones.');
        } else {
          const datos = this.extraerLista(res);
          const persona = datos[0];
          if (!persona) {
            this.mostrarErrorFinanciero('No se encontraron obligaciones para esta cédula y año.');
          } else {
            this.comuneroSeleccionadoFinanzas = {
              id: Number(persona.persona_id),
              nombres: persona.comunero_nombre ?? '',
              cedula: persona.cedula ?? cedula,
            };
            this.obligacionesComunero = datos.filter((ob: any) => ob.estado === 'PENDIENTE')
              .map((ob: any) => ({ ...ob, id: Number(ob.id) }));
            this.obligacionesSeleccionadasIds = this.obligacionesComunero.map((ob) => ob.id);
          }
        }
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        if (consulta !== this.consultaListado) return;
        this.mostrarErrorFinanciero(err.error?.message || err.error?.mensaje || 'No se pudieron consultar las obligaciones.');
        this.cdr.detectChanges();
      },
    });
  }

get obligacionesPorMes(): {
  etiqueta: string;
  obligaciones: any[];
  subtotal: number;
}[] {
  const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const grupos = new Map<string, {
    anio: number;
    mes: number;
    etiqueta: string;
    obligaciones: any[];
    subtotal: number;
  }>();
  for (const ob of this.obligacionesComunero) {
    const anioNumero = Number(ob.periodo_anio);
    const mesNumero = Number(ob.periodo_mes);
    const anio = Number.isInteger(anioNumero) && anioNumero > 0 ? anioNumero : 0;
    const mes = Number.isInteger(mesNumero) && mesNumero >= 1 && mesNumero <= 12 ? mesNumero : 0;
    const clave = `${anio}-${mes}`;
    if (!grupos.has(clave)) {
      grupos.set(clave, {
        anio,
        mes,
        etiqueta: `${mes ? meses[mes - 1] : 'Sin mes'}${anio ? ' ' + anio : ' · Sin año'}`,
        obligaciones: [],
        subtotal: 0,
      });
    }
    const grupo = grupos.get(clave)!;
    grupo.obligaciones.push(ob);
    const valor = Number(ob.valor ?? 0);
    grupo.subtotal += Number.isFinite(valor) ? valor : 0;
  }
  return [...grupos.values()]
    .sort((a, b) => a.anio - b.anio || a.mes - b.mes)
    .map((grupo) => ({
      etiqueta: grupo.etiqueta,
      obligaciones: grupo.obligaciones,
      subtotal: Number(grupo.subtotal.toFixed(2)),
    }));
}
get totalPendienteFinanzas(): number {
  const total = this.obligacionesComunero.reduce((suma, ob) => {
    const valor = Number(ob.valor ?? 0);
    return suma + (Number.isFinite(valor) ? valor : 0);
  }, 0);
  return Number(total.toFixed(2));
}  isObligacionSeleccionada(id: number): boolean {
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
      this.mostrarErrorFinanciero('Selecciona al menos una obligación para cobrar.');
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
      this.mostrarErrorFinanciero('Ingresa un valor recibido válido que cubra el total.');
      return;
    }
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
        this.obligacionesComunero = this.obligacionesComunero.filter((ob) => !ids.includes(ob.id));
        this.obligacionesSeleccionadasIds = [];
        this.valorRecibidoFinanzas = null;
        this.dataChanged.emit();
        try {
          this.generarPDFComprobante(comprobante);
        } catch (error) {
          console.error('Error al generar el comprobante', error);
          this.mostrarErrorFinanciero(
            'El pago fue registrado, pero no se pudo generar el PDF. ' +
            'No vuelvas a registrar el pago.',
          );
        }
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.procesandoPago = false;
        this.mostrarErrorFinanciero(err.error?.message || 'Error al procesar el pago.');
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
