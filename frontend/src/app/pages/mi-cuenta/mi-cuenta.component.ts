import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ConsultaService, DeudaItem } from '../../core/services/consulta.service';
import { AuthService } from '../../core/services/auth.service';
import { FinanzasService } from '../../core/services/finanzas.service';
import { ComprobantePdfService } from '../../core/services/comprobante-pdf.service';
import { NotificationService } from '../../core/services/notification.service';
import { Recibo, TipoRecibo, numeroRecibo } from '../../core/models/finanzas';
import { FechaLocalPipe } from '../../shared/pipes/fecha-local.pipe';
import { CurvasNivelComponent } from '../../shared/ui/curvas-nivel.component';
import { iniciales } from '../../core/utils/personas';

interface UsuarioResultado {
  cedula: string;
  nombres: string;
  sector: string;
  loteCodigo: string;
  totalPendiente: number;
  deudas: DeudaItem[];
}

@Component({
  selector: 'app-mi-cuenta',
  standalone: true,
  imports: [CommonModule, FechaLocalPipe, CurvasNivelComponent],
  templateUrl: './mi-cuenta.component.html',
  styleUrls: ['./mi-cuenta.component.scss'],
})
export class MiCuentaComponent implements OnInit {
  readonly iniciales = iniciales;

  cargando = true;
  resultado: UsuarioResultado | null = null;
  errorMensaje = '';

  /** Recibos vigentes del usuario: multas y otros (REC-…) y pago anual de agua (REC-AGUA-…). */
  recibos: Recibo[] = [];
  cargandoPagos = false;
  /** Clave (tipo-id) del recibo que se está imprimiendo o descargando. */
  imprimiendo: string | null = null;
  descargando: string | null = null;

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
      },
    });
  }

  cargarPagos(): void {
    this.cargandoPagos = true;
    this.finanzasService.getRecibos({ estado: 'VIGENTE' }).subscribe({
      next: (recibos) => {
        this.cargandoPagos = false;
        this.recibos = recibos;
        this.cdr.detectChanges();
      },
      error: () => {
        this.cargandoPagos = false;
        this.cdr.detectChanges();
      },
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
    return this.resultado ? this.resultado.deudas.filter((d) => d.estado === 'PENDIENTE') : [];
  }

  get deudasPagadas(): DeudaItem[] {
    return this.resultado ? this.resultado.deudas.filter((d) => d.estado === 'PAGADA') : [];
  }

  /** Saldo pendiente calculado por el servidor (en centavos, sin error de redondeo). */
  get totalPendiente(): number {
    return this.resultado?.totalPendiente ?? 0;
  }

  get ultimoRecibo(): Recibo | null {
    return this.recibos[0] ?? null;
  }

  clave(tipo: TipoRecibo, id: number): string {
    return `${tipo}-${id}`;
  }

  /** Recibo con el que se pagó una obligación, o null si no tiene uno vigente. */
  reciboDe(item: DeudaItem): { tipo: TipoRecibo; id: number } | null {
    if (item.tipo === 'AGUA_ANUAL')
      return item.pagoAnualId ? { tipo: 'AGUA', id: item.pagoAnualId } : null;
    return item.pagoId ? { tipo: 'GENERAL', id: item.pagoId } : null;
  }

  imprimirComprobante(tipo: TipoRecibo, id: number, descargar = false): void {
    if (this.imprimiendo || this.descargando) return;
    const clave = this.clave(tipo, id);
    if (descargar) this.descargando = clave;
    else this.imprimiendo = clave;
    this.cdr.detectChanges();

    const terminar = () => {
      this.imprimiendo = null;
      this.descargando = null;
      this.cdr.detectChanges();
    };
    this.finanzasService.getComprobante(tipo, id).subscribe({
      next: async (comprobante) => {
        try {
          if (descargar) {
            await this.pdfService.descargar(comprobante);
            this.notify.success('Comprobante descargado en PDF.');
          } else {
            await this.pdfService.imprimir(comprobante);
          }
        } catch {
          this.notify.error('No se pudo generar el comprobante.');
        } finally {
          terminar();
        }
      },
      error: (err) => {
        terminar();
        this.notify.error(
          err?.error?.message || 'No se pudo obtener la información del comprobante.',
        );
      },
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
      error: () => this.notify.error('No se pudo descargar el respaldo bancario.'),
    });
  }

  cerrarSesion() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
