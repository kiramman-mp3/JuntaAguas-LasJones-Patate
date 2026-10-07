import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { FinanzasService } from '../../../../core/services/finanzas.service';
import { DialogService } from '../../../../core/services/dialog.service';
import { ComprobantePdfService } from '../../../../core/services/comprobante-pdf.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { ObligacionItem, ResultadoFacturacion } from '../../../../core/models/finanzas';
import { CobroCajaComponent } from './cobro-caja/cobro-caja.component';
import { FacturacionMensualComponent } from './facturacion-mensual/facturacion-mensual.component';
import { TarifasComponent } from './tarifas/tarifas.component';
import { EgresosComponent } from './egresos/egresos.component';
import { HistorialFinancieroComponent } from './historial-financiero/historial-financiero.component';
import { FinanzasComponent } from './finanzas.component';

const balance = {
  totalIngresos: 100, totalEgresos: 40, totalPendientes: 30, totalVencido: 10, comunerosConDeuda: 3,
  balanceAlDia: 60, desde: null, hasta: null, fechaReporte: ''
};

const obligacion = (id: number, codigo: string, valor: number, mes: number | null = 1): ObligacionItem => ({
  id, persona_id: 7, concepto_id: 1, periodo_anio: 2026, periodo_mes: mes ?? undefined, fecha_emision: '2026-01-01',
  valor, origen: 'AUTOMATICA', estado: 'PENDIENTE', concepto_codigo: codigo, concepto_nombre: codigo
});

function configurar(api: Partial<Record<keyof FinanzasService, unknown>>, dialog: Partial<DialogService> = {}) {
  const notify = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: FinanzasService, useValue: { getBalance: () => of({ status: 'OK', balance, resumenMensual: [], carteraPorConcepto: [] }), ...api } },
      { provide: DialogService, useValue: dialog },
      { provide: NotificationService, useValue: notify },
      { provide: ComprobantePdfService, useValue: { imprimir: vi.fn(), descargar: vi.fn() } }
    ]
  });
  return { notify };
}

describe('Cobro en caja', () => {
  const comunero = { id: 7, cedula: '1804567890', nombres: 'Rosa', apellidos: 'Caiza', estado: 'ACTIVO' as const };

  function crear(registrarPago = vi.fn(() => of({ status: 'OK' as const, message: '', pagoId: 15, valorTotal: 8.5 }))) {
    configurar({
      buscarComuneros: () => of({ status: 'OK', data: [comunero] }),
      getObligaciones: () => of({ status: 'OK', data: [obligacion(1, 'AGUA_MENSUAL', 3.5), obligacion(2, 'MULTA_MINGA', 5, null)] }),
      registrarPago
    });
    const fixture = TestBed.createComponent(CobroCajaComponent);
    const c = fixture.componentInstance;
    c.seleccionarComunero(comunero);
    return { c, registrarPago };
  }

  it('preselecciona todo lo pendiente y filtra por tipo sin perder la selección', () => {
    const { c } = crear();
    expect(c.total()).toBe(8.5);
    c.filtro.set('AGUA');
    expect(c.visibles().map((o) => o.id)).toEqual([1]);
    c.alternarVisibles();
    expect(c.total()).toBe(5);
  });

  it('en efectivo exige cubrir el total y calcula el cambio', () => {
    const { c } = crear();
    expect(c.bloqueo()).toContain('valor recibido');
    c.onRecibido(5);
    expect(c.bloqueo()).toContain('Faltan $3.50');
    c.onRecibido(10);
    expect(c.bloqueo()).toBe('');
    expect(c.cambio()).toBe(1.5);
  });

  it('en transferencia exige la referencia y la envía con el pago', () => {
    const { c, registrarPago } = crear();
    c.metodo.set('TRANSFERENCIA');
    expect(c.bloqueo()).toContain('referencia');
    c.referencia.set(' 778899 ');
    c.cobrar();
    expect(registrarPago).toHaveBeenCalledWith({ persona_id: 7, obligacionesIds: [2, 1], metodo: 'TRANSFERENCIA', referencia: '778899', observacion: undefined });
    expect(c.comprobante()?.numero).toBe('REC-000015');
  });

  it('si el servidor rechaza el pago no muestra comprobante', () => {
    const { c } = crear(vi.fn(() => throwError(() => ({ error: { message: 'La obligación #1 ya se encuentra PAGADA' } }))));
    c.valorExacto();
    c.cobrar();
    expect(c.comprobante()).toBeNull();
    expect(c.procesando()).toBe(false);
  });
});

describe('Facturación mensual', () => {
  const previa: ResultadoFacturacion = { anio: 2026, mes: 3, valor: 3.5, comuneros: 110, generadas: 108, existentes: 2, total: 378 };

  it('calcula la vista previa al elegir un mes y solo emite tras confirmar', async () => {
    const facturarMes = vi.fn((_a: number, _m: number, simular: boolean) => of({ status: 'OK' as const, message: 'ok', data: simular ? previa : { ...previa } }));
    const confirmar = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    configurar({
      getResumenFacturacion: () => of({ status: 'OK', data: { anio: 2025, meses: [] } }),
      facturarMes
    }, { confirmar });
    const c = TestBed.createComponent(FacturacionMensualComponent).componentInstance;
    c.cambiarAnio('2025');
    c.seleccionar(3);
    expect(facturarMes).toHaveBeenLastCalledWith(2025, 3, true);
    expect(c.vistaPrevia()?.generadas).toBe(108);

    await c.emitir();
    expect(facturarMes).not.toHaveBeenCalledWith(2026, 3, false);
    await c.emitir();
    expect(facturarMes).toHaveBeenCalledWith(2026, 3, false);
  });

  it('no permite elegir meses futuros', () => {
    const facturarMes = vi.fn(() => of({ status: 'OK' as const, data: previa }));
    configurar({ getResumenFacturacion: () => of({ status: 'OK', data: { anio: 2099, meses: [] } }), facturarMes });
    const c = TestBed.createComponent(FacturacionMensualComponent).componentInstance;
    c.anio.set(c.anioActual + 1);
    c.seleccionar(1);
    expect(c.mesSeleccionado()).not.toBe(1);
    expect(facturarMes).not.toHaveBeenCalledWith(c.anioActual + 1, 1, true);
  });
});

describe('Tarifas', () => {
  it('exige que la nueva tarifa empiece después de la última registrada', () => {
    configurar({
      getConceptos: () => of({ status: 'OK', data: [{ id: 1, codigo: 'AGUA_MENSUAL', nombre: 'Agua', descripcion: null, tarifa_actual: 3.5 }] }),
      getTarifas: () => of({ status: 'OK', data: [
        { id: 2, concepto_id: 1, concepto_codigo: 'AGUA_MENSUAL', concepto_nombre: 'Agua', valor: 3.5, vigencia_desde: '2026-01-01', vigencia_hasta: null, observacion: null, activo: 1 }
      ] }),
      registrarTarifa: vi.fn()
    });
    const c = TestBed.createComponent(TarifasComponent).componentInstance;
    c.abrirFormulario(c.conceptos()[0]);
    expect(c.form.valor).toBe(3.5);
    expect(c.form.vigencia_desde > '2026-01-01').toBe(true);
    c.form.vigencia_desde = '2025-12-01';
    expect(c.errores().vigencia_desde).toContain('posterior');
    c.form.valor = 3.555;
    expect(c.errores().valor).toContain('dos decimales');
  });
});

describe('Egresos', () => {
  it('valida en el cliente con las reglas de la API antes de enviar', () => {
    const registrarEgreso = vi.fn();
    configurar({ getEgresos: () => of({ status: 'OK', data: [] }), registrarEgreso });
    const c = TestBed.createComponent(EgresosComponent).componentInstance;
    c.abrirFormulario();
    c.form.concepto = 'Tubo';
    c.form.valor = 12;
    c.form.ruc_proveedor = '123';
    c.guardar();
    expect(registrarEgreso).not.toHaveBeenCalled();
    expect(c.errorDe('ruc_proveedor')).toContain('10 o 13');
  });
});

describe('Historial financiero', () => {
  const historial = {
    anios: [
      { anio: 2026, ingresos: 30, egresos: 10.3, balance: 19.7, meses: [
        { mes: '2026-02', ingresos: 30, egresos: 0, balance: 30, pagos: 2, egresosRegistrados: 0 },
        { mes: '2026-01', ingresos: 0, egresos: 10.3, balance: -10.3, pagos: 0, egresosRegistrados: 1 }
      ] },
      { anio: 2025, ingresos: 5, egresos: 0, balance: 5, meses: [
        { mes: '2025-12', ingresos: 5, egresos: 0, balance: 5, pagos: 1, egresosRegistrados: 0 }
      ] }
    ],
    total: { ingresos: 35, egresos: 10.3, balance: 24.7 }
  };

  it('muestra los totales del servidor y abre solo el año más reciente', () => {
    configurar({ getHistorialAnual: () => of({ status: 'OK', data: historial }) });
    const c = TestBed.createComponent(HistorialFinancieroComponent).componentInstance;
    expect(c.historial()?.total.balance).toBe(24.7);
    expect(c.expandido('anio-2026')).toBe(true);
    expect(c.expandido('anio-2025')).toBe(false);
    expect(c.nombreMes('2026-02')).toBe('Febrero');
  });

  it('al abrir un mes consulta sus movimientos una sola vez, con el rango del mes', () => {
    const getPagos = vi.fn(() => of({ status: 'OK' as const, data: [
      { id: 3, fecha_pago: '2026-02-10T15:00:00.000Z', valor_total: 30, estado: 'VIGENTE', comunero_nombre: 'Rosa Caiza', observacion: null },
      { id: 4, fecha_pago: '2026-02-11T15:00:00.000Z', valor_total: 8, estado: 'ANULADO', comunero_nombre: 'Luis Toapanta', observacion: null }
    ] }));
    const getEgresos = vi.fn(() => of({ status: 'OK' as const, data: [] }));
    configurar({ getHistorialAnual: () => of({ status: 'OK', data: historial }), getPagos, getEgresos });
    const c = TestBed.createComponent(HistorialFinancieroComponent).componentInstance;

    c.alternarMes('2026-02');
    expect(getPagos).toHaveBeenCalledWith({ desde: '2026-02-01', hasta: '2026-02-28' });
    const movimientos = c.estadoMes('2026-02')?.movimientos ?? [];
    expect(movimientos.map((m) => m.numero)).toEqual(['REC-000004', 'REC-000003']);
    expect(movimientos[0].anulado).toBe(true);

    c.alternarMes('2026-02');
    c.alternarMes('2026-02');
    expect(getPagos).toHaveBeenCalledTimes(1);
  });
});

describe('Módulo de finanzas', () => {
  it('toma la sección de la URL y abre el egreso solo con ?nuevo=egreso', () => {
    configurar({ getEgresos: () => of({ status: 'OK', data: [] }) });
    const fixture = TestBed.createComponent(FinanzasComponent);
    const c = fixture.componentInstance;
    fixture.componentRef.setInput('seccion', 'egresos');
    fixture.componentRef.setInput('nuevo', 'egreso');
    expect(c.seccionActual()).toBe('egresos');
    expect(c.abrirEgreso()).toBe(true);
    fixture.componentRef.setInput('nuevo', undefined);
    expect(c.abrirEgreso()).toBe(false);
    fixture.componentRef.setInput('seccion', 'inventada');
    expect(c.seccionActual()).toBe('cobrar');
    expect(c.indicadores()?.historico.balanceAlDia).toBe(60);
  });

  it('cambiar de sección navega a su URL', () => {
    configurar({});
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const c = TestBed.createComponent(FinanzasComponent).componentInstance;
    c.cambiarSeccion('tarifas');
    expect(navigate).toHaveBeenCalledWith(['/admin/finanzas', 'tarifas']);
  });
});
