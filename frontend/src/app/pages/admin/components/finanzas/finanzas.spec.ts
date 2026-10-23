import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { FinanzasService } from '../../../../core/services/finanzas.service';
import { DialogService } from '../../../../core/services/dialog.service';
import { ComprobantePdfService } from '../../../../core/services/comprobante-pdf.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { ObligacionAnualAgua, ObligacionItem, ResultadoObligacionesAnuales } from '../../../../core/models/finanzas';
import { CobroCajaComponent } from './cobro-caja/cobro-caja.component';
import { FacturacionAnualComponent } from './facturacion-anual/facturacion-anual.component';
import { TarifasComponent } from './tarifas/tarifas.component';
import { EgresosComponent } from './egresos/egresos.component';
import { HistorialFinancieroComponent } from './historial-financiero/historial-financiero.component';
import { HistorialPagosComponent } from './historial-pagos/historial-pagos.component';
import { FinanzasComponent } from './finanzas.component';
import { GRUPOS_FINANZAS, grupoDeSeccion } from './grupos-finanzas';

const balance = {
  totalIngresos: 100, totalEgresos: 40, totalPendientes: 30, totalVencido: 10, usuariosConDeuda: 3,
  balanceAlDia: 60, desde: null, hasta: null, fechaReporte: ''
};

const obligacion = (id: number, codigo: string, valor: number, mes: number | null = 1): ObligacionItem => ({
  id, persona_id: 7, concepto_id: 1, periodo_anio: 2026, periodo_mes: mes ?? undefined, fecha_emision: '2026-01-01',
  valor, origen: 'AUTOMATICA', estado: 'PENDIENTE', concepto_codigo: codigo, concepto_nombre: codigo
});

const anual = (id: number, anio: number, valor = 10): ObligacionAnualAgua => ({ id, persona_id: 7, periodo_anio: anio, valor_total: valor, estado: 'PENDIENTE' });

function configurar(api: Partial<Record<keyof FinanzasService, unknown>>, dialog: Partial<DialogService> = {}) {
  const notify = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: FinanzasService, useValue: {
        getBalance: () => of({ status: 'OK', balance, resumenMensual: [], carteraPorConcepto: [] }),
        getObligacionesAnualesAgua: () => of({ status: 'OK', data: [] }),
        ...api
      } },
      { provide: DialogService, useValue: dialog },
      { provide: NotificationService, useValue: notify },
      { provide: ComprobantePdfService, useValue: { imprimir: vi.fn(), descargar: vi.fn() } }
    ]
  });
  return { notify };
}

describe('Cobro en caja', () => {
  const usuario = { id: 7, cedula: '1804567890', nombres: 'Rosa', apellidos: 'Caiza', estado: 'ACTIVO' as const };

  function crear(
    registrarPago = vi.fn(() => of({ status: 'OK' as const, message: '', pagoId: 15, valorTotal: 8.5 })),
    registrarPagoAnualAgua = vi.fn(() => of({ status: 'OK' as const, message: '', pagoId: 21, valorTotal: 20 }))
  ) {
    const getObligaciones = vi.fn(() => of({ status: 'OK', data: [obligacion(1, 'CUOTA_EXTRAORDINARIA', 3.5), obligacion(2, 'MULTA_MINGA', 5, null)] }));
    const getObligacionesAnualesAgua = vi.fn(() => of({ status: 'OK', data: [anual(50, 2025), anual(51, 2026)] }));
    configurar({
      buscarUsuarios: () => of({ status: 'OK', data: [usuario] }),
      getObligaciones,
      getObligacionesAnualesAgua,
      registrarPago,
      registrarPagoAnualAgua
    });
    const fixture = TestBed.createComponent(CobroCajaComponent);
    const c = fixture.componentInstance;
    c.seleccionarUsuario(usuario);
    return { c, registrarPago, registrarPagoAnualAgua, getObligaciones, getObligacionesAnualesAgua };
  }

  it('preselecciona lo pendiente de cada pestaña sin mezclar el pago anual de agua con las multas', () => {
    const { c } = crear();
    expect(c.pestana()).toBe('AGUA');
    expect(c.total()).toBe(20);
    c.alternarAgua(50);
    expect(c.total()).toBe(10);

    c.pestana.set('OTRAS');
    expect(c.total()).toBe(8.5);
    c.alternarTodasOtras();
    expect(c.total()).toBe(0);
  });

  it('pide cada lista una sola vez al elegir el usuario', () => {
    const { getObligaciones, getObligacionesAnualesAgua } = crear();
    expect(getObligaciones).toHaveBeenCalledTimes(1);
    expect(getObligacionesAnualesAgua).toHaveBeenCalledTimes(1);
  });

  it('si falla la carga del pago anual lo informa en lugar de mostrar al usuario al día', () => {
    configurar({
      getObligaciones: () => of({ status: 'OK', data: [] }),
      getObligacionesAnualesAgua: () => throwError(() => ({ error: { message: 'Servidor no disponible' } }))
    });
    const c = TestBed.createComponent(CobroCajaComponent).componentInstance;
    c.seleccionarUsuario(usuario);
    expect(c.errorAgua()).toBe('Servidor no disponible');
    expect(c.cargandoAgua()).toBe(false);
  });

  it('ofrece solo transferencia y depósito y exige referencia para ambos', () => {
    const { c } = crear();
    expect(c.metodos.map(m => m.valor)).toEqual(['TRANSFERENCIA', 'DEPOSITO']);
    expect(c.metodo()).toBe('TRANSFERENCIA');
    for (const metodo of ['TRANSFERENCIA', 'DEPOSITO'] as const) {
      c.metodo.set(metodo);
      c.referencia.set('');
      expect(c.bloqueo()).toContain('referencia');
      c.referencia.set('123');
      expect(c.bloqueo()).toBe('');
    }
  });

  it('el pago anual de agua usa su propio servicio y no ofrece adjuntar comprobante a un pago de otra tabla', () => {
    const { c, registrarPago, registrarPagoAnualAgua } = crear();
    expect(c.bloqueo()).toContain('referencia');
    c.referencia.set(' 778899 ');
    c.cobrar();
    expect(registrarPagoAnualAgua).toHaveBeenCalledWith({ persona_id: 7, obligacionesIds: [50, 51], metodo: 'TRANSFERENCIA', referencia: '778899', observacion: undefined });
    expect(registrarPago).not.toHaveBeenCalled();
    expect(c.comprobante()?.numero).toBe('REC-AGUA-000021');
    expect(c.pagoRegistradoId()).toBeNull();
  });

  it('las multas y otros rubros se cobran con el pago general y permiten adjuntar el comprobante bancario', () => {
    const { c, registrarPago, registrarPagoAnualAgua } = crear();
    c.pestana.set('OTRAS');
    c.metodo.set('DEPOSITO');
    c.referencia.set('778899');
    c.cobrar();
    expect(registrarPago).toHaveBeenCalledWith({ persona_id: 7, obligacionesIds: [2, 1], metodo: 'DEPOSITO', referencia: '778899', observacion: undefined });
    expect(c.pestana(), 'después de cobrar sigue en la misma pestaña').toBe('OTRAS');
    expect(registrarPagoAnualAgua).not.toHaveBeenCalled();
    expect(c.comprobante()?.numero).toBe('REC-000015');
    expect(c.pagoRegistradoId()).toBe(15);
  });

  it('agrupa lo pendiente en árbol año → mes → concepto con subtotal por mes y total por año', () => {
    configurar({
      getObligaciones: () => of({ status: 'OK', data: [
        obligacion(1, 'CUOTA_EXTRAORDINARIA', 3.5, 2),
        obligacion(2, 'MULTA_MINGA', 10, 2),
        obligacion(3, 'CUOTA_EXTRAORDINARIA', 3.5, 1),
        { ...obligacion(4, 'CUOTA_EXTRAORDINARIA', 3, 12), periodo_anio: 2025 },
        { ...obligacion(5, 'OTRO', 2, null), periodo_anio: undefined }
      ] })
    });
    const c = TestBed.createComponent(CobroCajaComponent).componentInstance;
    c.seleccionarUsuario(usuario);
    c.pestana.set('OTRAS');

    const arbol = c.arbol();
    expect(arbol.map((a) => [a.etiqueta, a.total])).toEqual([['2025', 3], ['2026', 17], ['Sin período', 2]]);
    const [, anio2026] = arbol;
    expect(anio2026.meses.map((m) => [m.etiqueta, m.subtotal])).toEqual([['Enero', 3.5], ['Febrero', 13.5]]);
    expect(anio2026.meses[1].obligaciones.map((o) => o.concepto_nombre)).toEqual(['CUOTA_EXTRAORDINARIA', 'MULTA_MINGA']);
  });

  it('marca o desmarca un mes o un año completo y refleja la selección parcial', () => {
    configurar({ getObligaciones: () => of({ status: 'OK', data: [obligacion(1, 'CUOTA_EXTRAORDINARIA', 3.5, 1), obligacion(2, 'MULTA_MINGA', 5, 2)] }) });
    const c = TestBed.createComponent(CobroCajaComponent).componentInstance;
    c.seleccionarUsuario(usuario);
    c.pestana.set('OTRAS');
    const [anio] = c.arbol();
    const [enero, febrero] = anio.meses;

    c.alternarGrupo(c.idsDe(enero));
    expect(c.total()).toBe(5);
    expect(c.estadoSeleccion(c.idsDe(anio))).toBe('algunas');
    expect(c.estadoSeleccion(c.idsDe(enero))).toBe('ninguna');

    c.alternarGrupo(c.idsDe(anio));
    expect(c.estadoSeleccion(c.idsDe(anio))).toBe('todas');
    c.alternarGrupo(c.idsDe(anio));
    expect(c.total()).toBe(0);
    expect(c.estadoSeleccion(c.idsDe(febrero))).toBe('ninguna');

    c.alternarNodo(anio.clave);
    expect(c.estaAbierto(anio.clave)).toBe(false);
  });

  it('si el servidor rechaza el pago no muestra comprobante', () => {
    const rechazo = () => throwError(() => ({ error: { message: 'La obligación #1 ya se encuentra PAGADA' } }));
    const { c } = crear(vi.fn(rechazo), vi.fn(rechazo));
    for (const pestana of ['AGUA', 'OTRAS'] as const) {
      c.pestana.set(pestana);
      c.referencia.set('123');
      c.cobrar();
      expect(c.comprobante()).toBeNull();
      expect(c.procesando()).toBe(false);
    }
  });
});

describe('Pago anual de agua', () => {
  const previa: ResultadoObligacionesAnuales = { anio: 2026, valor: 42, usuarios: 110, generadas: 108, existentes: 2, total: 4536 };

  it('calcula la vista previa del año y solo emite tras confirmar', async () => {
    const generar = vi.fn((p: { simular?: boolean }) => of({ status: 'OK' as const, message: 'ok', data: p.simular ? previa : { ...previa } }));
    const confirmar = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    configurar({
      getResumenAnualAgua: () => of({ status: 'OK', data: { anio: 2026, emitidas: 0, pagadas: 0, pendientes: 0, total: 0, recaudado: 0 } }),
      generarObligacionesAnualesAgua: generar
    }, { confirmar });
    const c = TestBed.createComponent(FacturacionAnualComponent).componentInstance;
    c.cambiarAnio(2026);
    expect(generar).toHaveBeenLastCalledWith({ anio: 2026, valor_total: null, simular: true });
    expect(c.vistaPrevia()?.generadas).toBe(108);

    await c.emitir();
    expect(generar).not.toHaveBeenCalledWith({ anio: 2026, valor_total: null });
    await c.emitir();
    expect(generar).toHaveBeenCalledWith({ anio: 2026, valor_total: null });
  });

  it('solo ofrece el año actual y los anteriores, y un valor escrito recalcula la vista previa', () => {
    const generar = vi.fn(() => of({ status: 'OK' as const, data: previa }));
    configurar({ getResumenAnualAgua: () => of({ status: 'OK', data: { anio: 2026, emitidas: 0, pagadas: 0, pendientes: 0, total: 0, recaudado: 0 } }), generarObligacionesAnualesAgua: generar });
    const c = TestBed.createComponent(FacturacionAnualComponent).componentInstance;
    expect(Math.max(...c.anios)).toBe(c.anioActual);
    c.cambiarValor('45.5');
    expect(generar).toHaveBeenLastCalledWith({ anio: c.anioActual, valor_total: 45.5, simular: true });
    c.cambiarValor('');
    expect(c.valor()).toBeNull();
  });
});

describe('Tarifas', () => {
  it('exige que la nueva tarifa empiece después de la última registrada', () => {
    configurar({
      getConceptos: () => of({ status: 'OK', data: [{ id: 1, codigo: 'AGUA_ANUAL', nombre: 'Agua', descripcion: null, tarifa_actual: 3.5 }] }),
      getTarifas: () => of({ status: 'OK', data: [
        { id: 2, concepto_id: 1, concepto_codigo: 'AGUA_ANUAL', concepto_nombre: 'Agua', valor: 3.5, vigencia_desde: '2026-01-01', vigencia_hasta: null, observacion: null, activo: 1 }
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

  it('el RUC descarta todo lo que no sea dígito mientras se escribe', () => {
    configurar({ getEgresos: () => of({ status: 'OK', data: [] }) });
    const c = TestBed.createComponent(EgresosComponent).componentInstance;
    const campo = document.createElement('input');
    campo.value = '18-912a3456 70019';
    c.soloDigitosRuc({ target: campo } as unknown as Event);
    expect(campo.value).toBe('1891234567001');
    expect(c.form.ruc_proveedor).toBe('1891234567001');
  });
});

describe('Historial de recibos', () => {
  const recibo = (tipo: 'GENERAL' | 'AGUA', id: number) => ({
    tipo, id, numero: tipo === 'AGUA' ? `REC-AGUA-${id}` : `REC-${id}`, fecha_pago: '2026-02-10T15:00:00.000Z',
    usuario_nombre: 'Rosa Caiza', cedula: '1804567890', detalle: tipo === 'AGUA' ? 'Agua 2026' : '1 obligación',
    metodo: 'DEPOSITO' as const, referencia: 'D-1', valor_total: 42, estado: 'VIGENTE' as const,
    motivo_anulacion: null, comprobante_url: null, registrado_por_usuario: null
  });

  it('lista juntos los dos tipos de pago, filtra por tipo y anula cada uno con su propio servicio', async () => {
    const anularRecibo = vi.fn(() => of({ status: 'OK' as const, message: 'Anulado' }));
    const solicitar = vi.fn(async () => 'Error de digitación');
    configurar({ getRecibos: () => of([recibo('AGUA', 3), recibo('GENERAL', 4)]), anularRecibo }, { solicitar });
    const c = TestBed.createComponent(HistorialPagosComponent).componentInstance;
    expect(c.filtrados().map((r) => r.numero)).toEqual(['REC-AGUA-3', 'REC-4']);
    c.tipo.set('AGUA');
    expect(c.filtrados().map((r) => r.numero)).toEqual(['REC-AGUA-3']);

    await c.anular(c.filtrados()[0]);
    expect(anularRecibo).toHaveBeenCalledWith('AGUA', 3, 'Error de digitación');
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
    const recibo = (tipo: 'GENERAL' | 'AGUA', id: number, numero: string, fecha_pago: string, estado: 'VIGENTE' | 'ANULADO') => ({
      tipo, id, numero, fecha_pago, usuario_nombre: 'Rosa Caiza', cedula: '', detalle: '1 obligación', metodo: 'DEPOSITO' as const,
      referencia: null, valor_total: 8, estado, motivo_anulacion: null, comprobante_url: null, registrado_por_usuario: null
    });
    const getPagos = vi.fn(() => of([
      recibo('GENERAL', 4, 'REC-000004', '2026-02-11T15:00:00.000Z', 'ANULADO'),
      recibo('AGUA', 3, 'REC-AGUA-000003', '2026-02-10T15:00:00.000Z', 'VIGENTE')
    ]));
    const getEgresos = vi.fn(() => of({ status: 'OK' as const, data: [] }));
    configurar({ getHistorialAnual: () => of({ status: 'OK', data: historial }), getRecibos: getPagos, getEgresos });
    const c = TestBed.createComponent(HistorialFinancieroComponent).componentInstance;

    c.alternarMes('2026-02');
    expect(getPagos).toHaveBeenCalledWith({ desde: '2026-02-01', hasta: '2026-02-28' });
    const movimientos = c.estadoMes('2026-02')?.movimientos ?? [];
    expect(movimientos.map((m) => m.numero), 'incluye el pago anual de agua').toEqual(['REC-000004', 'REC-AGUA-000003']);
    expect(movimientos[0].anulado).toBe(true);

    c.alternarMes('2026-02');
    c.alternarMes('2026-02');
    expect(getPagos).toHaveBeenCalledTimes(1);
  });
});

describe('Apartados de finanzas', () => {
  const crear = (grupo: string, seccion?: string) => {
    const fixture = TestBed.createComponent(FinanzasComponent);
    fixture.componentRef.setInput('grupo', grupo);
    fixture.componentRef.setInput('seccion', seccion);
    return fixture;
  };

  it('define tres apartados del menú con sus secciones', () => {
    expect(GRUPOS_FINANZAS.map((g) => [g.etiqueta, g.secciones.map((s) => s.id)])).toEqual([
      ['Cobros y pagos', ['cobrar', 'egresos']],
      ['Ajustes', ['tarifas', 'facturacion']],
      ['Historial', ['pagos', 'historial']]
    ]);
  });

  it('toma la sección de la URL dentro de su apartado y abre el egreso solo con ?nuevo=egreso', () => {
    configurar({ getEgresos: () => of({ status: 'OK', data: [] }) });
    const fixture = crear('cobros', 'egresos');
    const c = fixture.componentInstance;
    fixture.componentRef.setInput('nuevo', 'egreso');
    expect(c.seccionActual()).toBe('egresos');
    expect(c.abrirEgreso()).toBe(true);
    fixture.componentRef.setInput('nuevo', undefined);
    expect(c.abrirEgreso()).toBe(false);
    // Una sección de otro apartado o inventada muestra la primera del apartado.
    fixture.componentRef.setInput('seccion', 'tarifas');
    expect(c.seccionActual()).toBe('cobrar');
    fixture.componentRef.setInput('seccion', 'inventada');
    expect(c.seccionActual()).toBe('cobrar');
    expect(c.indicadores()?.historico.balanceAlDia).toBe(60);
  });

  it('Ajustes no muestra indicadores de caja; Cobros e Historial sí', () => {
    configurar({});
    expect(crear('ajustes').componentInstance.grupoActual().indicadores).toBe(false);
    expect(crear('cobros').componentInstance.grupoActual().indicadores).toBe(true);
    expect(crear('historial').componentInstance.grupoActual().indicadores).toBe(true);
  });

  it('cambiar de sección y las flechas navegan dentro del apartado', () => {
    configurar({ getHistorialAnual: () => of({ status: 'OK', data: { anios: [], total: { ingresos: 0, egresos: 0, balance: 0 } } }) });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const c = crear('historial', 'historial').componentInstance;
    c.cambiarSeccion('pagos');
    expect(navigate).toHaveBeenCalledWith(['/admin', 'historial', 'pagos']);

    c.onTeclaSegmento(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(navigate).toHaveBeenLastCalledWith(['/admin', 'historial', 'pagos']);
  });

  it('las URL antiguas /admin/finanzas/… llevan a su nuevo apartado', () => {
    expect(grupoDeSeccion('cobrar').id).toBe('cobros');
    expect(grupoDeSeccion('egresos').id).toBe('cobros');
    expect(grupoDeSeccion('tarifas').id).toBe('ajustes');
    expect(grupoDeSeccion('facturacion').id).toBe('ajustes');
    expect(grupoDeSeccion('pagos').id).toBe('historial');
    expect(grupoDeSeccion('historial').id).toBe('historial');
    expect(grupoDeSeccion('inventada').id).toBe('cobros');
  });
});
