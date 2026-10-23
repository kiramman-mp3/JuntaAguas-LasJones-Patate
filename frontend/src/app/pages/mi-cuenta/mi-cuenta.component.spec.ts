import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { MiCuentaComponent } from './mi-cuenta.component';
import { ConsultaService, DeudaItem } from '../../core/services/consulta.service';
import { AuthService } from '../../core/services/auth.service';
import { FinanzasService } from '../../core/services/finanzas.service';
import { ComprobantePdfService } from '../../core/services/comprobante-pdf.service';
import { NotificationService } from '../../core/services/notification.service';

const deuda = (parcial: Partial<DeudaItem>): DeudaItem => ({
  id: 1, tipo: 'OBLIGACION', concepto: 'Multa', anio: 2026, periodo: 'Cuota/Multa', valor: 10,
  estado: 'PENDIENTE', fechaEmision: '2026-01-01', pagoId: null, pagoAnualId: null, ...parcial
});

describe('Mi cuenta', () => {
  let finanzas: { getRecibos: ReturnType<typeof vi.fn>; getComprobante: ReturnType<typeof vi.fn> };
  let pdf: { imprimir: ReturnType<typeof vi.fn>; descargar: ReturnType<typeof vi.fn> };

  function crear(deudas: DeudaItem[], totalPendiente: number) {
    finanzas = {
      getRecibos: vi.fn(() => of([])),
      getComprobante: vi.fn(() => of({ numero: 'REC-AGUA-000009', fechaHora: '', usuarioNombre: '', usuarioCedula: '', lineas: [], total: 42 }))
    };
    pdf = { imprimir: vi.fn(async () => undefined), descargar: vi.fn(async () => undefined) };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { getUser: () => ({ cedula: '1804567890' }), logout: vi.fn() } },
        { provide: ConsultaService, useValue: { consultarPorCedula: () => of({ status: 'OK', resultado: {
          cedula: '1804567890', nombres: 'Rosa Caiza', sector: 'La Jones', loteCodigo: 'LJA-001', totalPendiente, deudas
        } }) } },
        { provide: FinanzasService, useValue: finanzas },
        { provide: ComprobantePdfService, useValue: pdf },
        { provide: NotificationService, useValue: { success: vi.fn(), error: vi.fn() } }
      ]
    });
    const c = TestBed.createComponent(MiCuentaComponent).componentInstance;
    c.ngOnInit();
    return c;
  }

  it('el pago anual de agua pendiente impide mostrar al usuario como al día', () => {
    const c = crear([deuda({ tipo: 'AGUA_ANUAL', concepto: 'Pago anual de agua', valor: 42 })], 42);
    expect(c.totalPendiente).toBe(42);
    expect(c.deudasPendientes.map((d) => d.tipo)).toEqual(['AGUA_ANUAL']);
  });

  it('cada obligación pagada imprime su propio comprobante; sin uno vigente no ofrece otro', () => {
    const c = crear([
      deuda({ id: 7, tipo: 'AGUA_ANUAL', estado: 'PAGADA', pagoAnualId: 9 }),
      deuda({ id: 8, estado: 'PAGADA', pagoId: 15 }),
      deuda({ id: 9, estado: 'PAGADA' })
    ], 0);
    const [agua, multa, huerfana] = c.deudasPagadas;
    expect(c.reciboDe(agua)).toEqual({ tipo: 'AGUA', id: 9 });
    expect(c.reciboDe(multa)).toEqual({ tipo: 'GENERAL', id: 15 });
    expect(c.reciboDe(huerfana)).toBeNull();

    c.imprimirComprobante('AGUA', 9);
    expect(finanzas.getComprobante).toHaveBeenCalledWith('AGUA', 9);
  });
});
