import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { AdminComponent } from './admin.component';
import { DashboardResumen } from '../../core/models/api-payloads';

const resumen = {
  fecha: '2026-10-06',
  comunidad: { comunerosActivos: 114, lotes: 190, sectores: 4, turnosActivos: 182, cuentasActivas: 27, eventosAnio: 15 },
  finanzas: {
    recaudadoMes: 120.5, recaudadoAnio: 5300, egresosMes: 150, egresosAnio: 2100, saldoCaja: 7041.5,
    carteraPendiente: 1200, carteraVencida: 800, comunerosEnMora: 21
  },
  cobranza: { emitido: 3500, cobrado: 3000, porcentaje: 0.857 },
  asistencia: { promedio: 0.88, ultimosEventos: [] },
  proximosEventos: []
} satisfies DashboardResumen;

const cdr = { detectChanges: vi.fn() } as any;

describe('Dashboard de administración', () => {
  it('muestra el resumen real del backend', () => {
    const admin = { getDashboardResumen: vi.fn(() => of({ status: 'OK', data: resumen })) };
    const component = new AdminComponent(admin as any, cdr);
    component.ngOnInit();
    expect(admin.getDashboardResumen).toHaveBeenCalled();
    expect(component.resumen?.finanzas.carteraPendiente).toBe(1200);
    expect(component.resumen?.comunidad.comunerosActivos).toBe(114);
    expect(component.cargandoResumen).toBe(false);
    expect(component.errorCarga).toBe('');
  });

  it('informa el error sin inventar valores', () => {
    const admin = { getDashboardResumen: vi.fn(() => throwError(() => new Error('sin red'))) };
    const component = new AdminComponent(admin as any, cdr);
    component.ngOnInit();
    expect(component.resumen).toBeNull();
    expect(component.errorCarga).not.toBe('');
  });
});
