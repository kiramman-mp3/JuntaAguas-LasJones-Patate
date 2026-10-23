import { Injectable } from '@angular/core';
import { cargarJsPdf } from '../utils/jspdf';
import {
  PagoAnualDetalle,
  PagoDetalle,
  etiquetaPeriodo,
  numeroRecibo,
  numeroReciboAgua,
} from '../models/finanzas';
import { formatearFecha } from '../utils/fechas';

export interface ComprobanteLinea {
  concepto: string;
  periodo: string;
  valor: number;
}

export interface Comprobante {
  numero: string;
  fechaHora: string;
  usuarioNombre: string;
  usuarioCedula: string;
  lineas: ComprobanteLinea[];
  total: number;
  /** Solo en pagos en efectivo: lo que entregó el usuario. */
  valorRecibido?: number;
  metodo?: string;
  referencia?: string | null;
  observacion?: string | null;
  anulado?: boolean;
}

/** Comprobante de un pago de multas y otros cobros, para reimprimirlo. */
export function comprobanteDePago(p: PagoDetalle): Comprobante {
  return {
    numero: numeroRecibo(p.id),
    fechaHora: formatearFecha(p.fecha_pago, 'conHora'),
    usuarioNombre: p.usuario_nombre,
    usuarioCedula: p.cedula,
    lineas: (p.detalles ?? []).map((d) => ({
      concepto: d.concepto_nombre,
      periodo: etiquetaPeriodo(d.periodo_anio, d.periodo_mes),
      valor: Number(d.valor_pagado),
    })),
    total: Number(p.valor_total),
    metodo: p.metodo,
    referencia: p.referencia,
    observacion: p.estado === 'ANULADO' ? `Anulado: ${p.motivo_anulacion ?? ''}` : p.observacion,
    anulado: p.estado === 'ANULADO',
  };
}

/** Comprobante de un pago anual de agua, para reimprimirlo. */
export function comprobanteDePagoAnual(p: PagoAnualDetalle): Comprobante {
  return {
    numero: numeroReciboAgua(p.id),
    fechaHora: formatearFecha(p.fecha_pago, 'conHora'),
    usuarioNombre: p.usuario_nombre,
    usuarioCedula: p.cedula,
    lineas: (p.detalles ?? []).map((d) => ({
      concepto: 'Pago anual de agua',
      periodo: `Año ${d.periodo_anio}`,
      valor: Number(d.valor_pagado),
    })),
    total: Number(p.valor_total),
    metodo: p.metodo,
    referencia: p.referencia,
    observacion: p.estado === 'ANULADO' ? `Anulado: ${p.motivo_anulacion ?? ''}` : p.observacion,
    anulado: p.estado === 'ANULADO',
  };
}

/**
 * Genera el comprobante de pago en PDF (A5). jsPDF y autotable se cargan
 * con import() la primera vez, para no inflar el bundle del panel administrativo.
 */
@Injectable({ providedIn: 'root' })
export class ComprobantePdfService {
  /** Abre el diálogo de impresión del navegador con el comprobante. */
  async imprimir(c: Comprobante): Promise<void> {
    const doc = await this.construir(c);
    doc.autoPrint();
    const url = doc.output('bloburl').toString();
    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    Object.assign(iframe.style, {
      position: 'fixed',
      right: '0',
      bottom: '0',
      width: '0',
      height: '0',
      border: '0',
    });
    iframe.src = url;
    iframe.onload = () => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      // El iframe se retira cuando el usuario ya cerró el diálogo de impresión.
      setTimeout(() => {
        iframe.remove();
        URL.revokeObjectURL(url);
      }, 60_000);
    };
    document.body.appendChild(iframe);
  }

  /** Descarga el comprobante como archivo. */
  async descargar(c: Comprobante): Promise<void> {
    const doc = await this.construir(c);
    doc.save(`${c.numero}.pdf`);
  }

  private async construir(c: Comprobante) {
    const { jsPDF, autoTable } = await cargarJsPdf();
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a5' });
    const centro = doc.internal.pageSize.getWidth() / 2;
    const dinero = (n: number) => `$${n.toFixed(2)}`;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('JUNTA DE AGUA Y RIEGO "LA JONES"', centro, 15, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    doc.text('Patate - Tungurahua - Ecuador', centro, 20, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text(`COMPROBANTE DE PAGO ${c.numero}`, centro, 27, { align: 'center' });
    doc.setLineWidth(0.4);
    doc.line(15, 30, 133, 30);

    if (c.anulado) {
      doc.setTextColor(200, 30, 30);
      doc.setFontSize(28);
      doc.text('ANULADO', centro, 105, { align: 'center', angle: 20 });
      doc.setTextColor(0, 0, 0);
    }

    doc.setFontSize(9);
    const filas: [string, string][] = [
      ['Usuario:', c.usuarioNombre],
      ['Cédula:', c.usuarioCedula],
      ['Fecha / hora:', c.fechaHora],
      [
        'Forma de pago:',
        c.referencia ? `${c.metodo ?? ''} · Ref. ${c.referencia}` : (c.metodo ?? 'EFECTIVO'),
      ],
    ];
    let y = 36;
    for (const [etiqueta, valor] of filas) {
      doc.setFont('helvetica', 'bold');
      doc.text(etiqueta, 15, y);
      doc.setFont('helvetica', 'normal');
      doc.text(doc.splitTextToSize(valor, 85), 45, y);
      y += 6;
    }

    const pie: string[][] = [['TOTAL COBRADO', '', dinero(c.total)]];
    if (c.valorRecibido !== undefined) {
      pie.push(['VALOR RECIBIDO', '', dinero(c.valorRecibido)]);
      pie.push(['CAMBIO ENTREGADO', '', dinero(Math.max(0, c.valorRecibido - c.total))]);
    }
    autoTable(doc, {
      startY: y,
      head: [['Concepto', 'Período', 'Valor']],
      body: c.lineas.map((l) => [l.concepto, l.periodo, dinero(l.valor)]),
      foot: pie,
      showFoot: 'lastPage',
      theme: 'grid',
      margin: { left: 15, right: 15 },
      styles: { fontSize: 8.5, textColor: [0, 0, 0] },
      headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
      footStyles: { fillColor: [248, 248, 248], textColor: [0, 0, 0], fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 60 },
        1: { cellWidth: 35 },
        2: { cellWidth: 23, halign: 'right' },
      },
    });

    const finalY =
      (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 40;
    let notaY = finalY + 7;
    if (c.observacion) {
      doc.setFontSize(7.5);
      doc.setTextColor(100, 100, 100);
      doc.text(`Obs.: ${c.observacion}`, 15, notaY, { maxWidth: 118 });
      notaY += 7;
    }
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(80, 80, 80);
    doc.text('Gracias por mantener al día sus aportes a la Junta de Agua.', centro, notaY, {
      align: 'center',
    });
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('CAJA GENERAL - JUNTA LA JONES', centro, notaY + 5, { align: 'center' });
    return doc;
  }
}
