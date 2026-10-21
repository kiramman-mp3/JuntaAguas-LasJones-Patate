import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ConsultaService, DeudaItem } from '../../core/services/consulta.service';
import { AuthService } from '../../core/services/auth.service';
import { FinanzasService } from '../../core/services/finanzas.service';
import { ComprobantePdfService } from '../../core/services/comprobante-pdf.service';
import { NotificationService } from '../../core/services/notification.service';
import { Pago, numeroRecibo, etiquetaPeriodo } from '../../core/models/finanzas';
import { formatearFecha } from '../../core/utils/fechas';
import { FechaLocalPipe } from '../../shared/pipes/fecha-local.pipe';

interface UsuarioResultado {
  cedula: string;
  nombres: string;
  sector: string;
  loteCodigo: string;
  deudas: DeudaItem[];
}

@Component({
  selector: 'app-mi-cuenta',
  standalone: true,
  imports: [CommonModule, FechaLocalPipe],
  templateUrl: './mi-cuenta.component.html',
  styleUrls: ['./mi-cuenta.component.scss']
})
export class MiCuentaComponent implements OnInit {
  cargando = true;
  resultado: UsuarioResultado | null = null;
  errorMensaje = '';

  pagos: Pago[] = [];
  cargandoPagos = false;
  imprimiendoId: number | null = null;
  descargandoId: number | null = null;

  readonly numeroRecibo = numeroRecibo;

  private consultaService = inject(ConsultaService);
  private authService = inject(AuthService);
  private finanzasService = inject(FinanzasService);
  private pdfService = inject(ComprobantePdfService);
  private notify = inject(NotificationService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  ngOnInit() {
    const user = this.authService.getUser();
    if (!user || !user.cedula) {
      this.router.navigate(['/login']);
      return;
    }

    this.consultarDatos(user.cedula);
    this.cargarPagos();
  }

  consultarDatos(cedula: string) {
    this.cargando = true;
    this.errorMensaje = '';

    this.consultaService.consultarPorCedula(cedula).subscribe({
      next: (res) => {
        this.cargando = false;
        if (res && res.resultado) {
          this.resultado = res.resultado;
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.cargando = false;
        if (err.status === 404) {
          this.errorMensaje = 'No se encontró información financiera para su cuenta.';
        } else {
          this.errorMensaje = 'Error al cargar los datos. Intente más tarde.';
        }
        this.cdr.detectChanges();
      }
    });
  }

  cargarPagos(): void {
    this.cargandoPagos = true;
    this.finanzasService.getPagos({ estado: 'VIGENTE' }).subscribe({
      next: (res) => {
        this.cargandoPagos = false;
        this.pagos = (res.data || []).map((p) => ({ ...p, valor_total: Number(p.valor_total) }));
        this.cdr.detectChanges();
      },
      error: () => {
        this.cargandoPagos = false;
        this.cdr.detectChanges();
      }
    });
  }

  reintentar() {
    const user = this.authService.getUser();
    if (user && user.cedula) {
      this.consultarDatos(user.cedula);
      this.cargarPagos();
    }
  }

  get deudasPendientes(): DeudaItem[] {
    return this.resultado ? this.resultado.deudas.filter(d => d.estado === 'PENDIENTE') : [];
  }

  get deudasPagadas(): DeudaItem[] {
    return this.resultado ? this.resultado.deudas.filter(d => d.estado === 'PAGADA') : [];
  }

  get totalPendiente(): number {
    if (!this.resultado) return 0;
    return this.resultado.deudas
      .filter(d => d.estado === 'PENDIENTE')
      .reduce((sum, d) => sum + Number(d.valor), 0);
  }

  get ultimoPago(): Pago | null {
    return this.pagos.length > 0 ? this.pagos[0] : null;
  }

  imprimirComprobante(pagoId: number, descargar = false): void {
    if (this.imprimiendoId || this.descargandoId) return;
    if (descargar) {
      this.descargandoId = pagoId;
    } else {
      this.imprimiendoId = pagoId;
    }
    this.cdr.detectChanges();

    this.finanzasService.getPago(pagoId).subscribe({
      next: async (res) => {
        const p = res.data;
        try {
          const comprobante = {
            numero: numeroRecibo(p.id),
            fechaHora: formatearFecha(p.fecha_pago, 'conHora'),
            usuarioNombre: p.usuario_nombre,
            usuarioCedula: p.cedula,
            lineas: (p.detalles || []).map((d) => ({
              concepto: d.concepto_nombre,
              periodo: etiquetaPeriodo(d.periodo_anio, d.periodo_mes),
              valor: Number(d.valor_pagado)
            })),
            total: Number(p.valor_total),
            metodo: p.metodo,
            referencia: p.referencia,
            observacion: p.estado === 'ANULADO' ? `Anulado: ${p.motivo_anulacion ?? ''}` : p.observacion,
            anulado: p.estado === 'ANULADO'
          };
          if (descargar) {
            await this.pdfService.descargar(comprobante);
            this.notify.success('Comprobante descargado en PDF.');
          } else {
            await this.pdfService.imprimir(comprobante);
          }
        } catch {
          this.notify.error('No se pudo generar el comprobante.');
        } finally {
          this.imprimiendoId = null;
          this.descargandoId = null;
          this.cdr.detectChanges();
        }
      },
      error: (err) => {
        this.imprimiendoId = null;
        this.descargandoId = null;
        this.notify.error(err?.error?.message || 'No se pudo obtener la información del comprobante.');
        this.cdr.detectChanges();
      }
    });
  }

  descargarComprobanteBancario(pagoId: number): void {
    this.finanzasService.descargarComprobante(pagoId).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const ext = blob.type.includes('pdf') ? 'pdf' : blob.type.includes('png') ? 'png' : 'jpg';
        a.download = `Comprobante_bancario_${numeroRecibo(pagoId)}.${ext}`;
        a.click();
        URL.revokeObjectURL(url);
      },
      error: () => this.notify.error('No se pudo descargar el respaldo bancario.')
    });
  }

  cerrarSesion() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
