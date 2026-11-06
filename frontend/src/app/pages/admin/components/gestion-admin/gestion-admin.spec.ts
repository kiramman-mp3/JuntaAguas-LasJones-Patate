import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { GestionService } from '../../../../core/services/gestion.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { AuditoriaComponent } from './auditoria/auditoria.component';
import { InventarioComponent } from './inventario/inventario.component';
import { PlanAnualComponent } from './plan-anual/plan-anual.component';

function configurar(api: Partial<Record<keyof GestionService, unknown>>) {
  const notify = { success: vi.fn(), error: vi.fn(), warning: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      {
        provide: GestionService,
        useValue: {
          getAuditoria: () =>
            of({ status: 'OK', data: [], pagination: { total: 0, page: 1, limit: 25 } }),
          getInventario: () => of({ status: 'OK', data: [] }),
          getPlanes: () => of({ status: 'OK', data: [] }),
          ...api,
        },
      },
      { provide: NotificationService, useValue: notify },
    ],
  });
  return { notify };
}

describe('Gestión interna', () => {
  it('la auditoría filtra por días y resume el detalle en una línea', () => {
    const getAuditoria = vi.fn(() =>
      of({ status: 'OK' as const, data: [], pagination: { total: 0, page: 1, limit: 25 } }),
    );
    configurar({ getAuditoria });
    const c = TestBed.createComponent(AuditoriaComponent).componentInstance;
    expect(getAuditoria).toHaveBeenCalledWith(
      expect.objectContaining({ desde: c.desde(), hasta: c.hasta(), page: 1, limit: 25 }),
    );
    c.accion.set('PAGO');
    c.cargar();
    expect(getAuditoria).toHaveBeenLastCalledWith(expect.objectContaining({ accion: 'PAGO' }));

    const base = {
      id: 1,
      cuenta_id: 1,
      accion: 'PAGO',
      entidad: 'pagos',
      entidad_id: 5,
      fecha: '',
      ip: null,
      cuenta_usuario: null,
      persona_nombre: null,
    };
    expect(c.resumen({ ...base, detalle: { valorTotal: 42, metodo: 'DEPOSITO' } })).toBe(
      'valorTotal: 42 · metodo: DEPOSITO',
    );
    expect(c.resumen({ ...base, detalle: '{"motivo":"Error"}' })).toBe('motivo: Error');
    expect(c.resumen({ ...base, detalle: null })).toBe('—');
  });

  it('la auditoría pide la página elegida y vuelve a la primera al cambiar un filtro (H-24)', () => {
    const getAuditoria = vi.fn(() =>
      of({ status: 'OK' as const, data: [], pagination: { total: 240, page: 1, limit: 25 } }),
    );
    configurar({ getAuditoria });
    const c = TestBed.createComponent(AuditoriaComponent).componentInstance;
    expect(c.total()).toBe(240);

    c.cambiarPagina(3);
    expect(getAuditoria).toHaveBeenLastCalledWith(expect.objectContaining({ page: 3, limit: 25 }));

    c.accion.set('PAGO');
    c.filtrar();
    expect(c.pagina()).toBe(1);
    expect(getAuditoria).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1, accion: 'PAGO' }),
    );

    c.cambiarPagina(2);
    c.cambiarPorPagina(50);
    expect(getAuditoria).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, limit: 50 }));
  });

  it('el inventario suma el valor total y valida antes de registrar', () => {
    const registrarBien = vi.fn(() => of({ status: 'OK' as const, data: null, bienId: 3 }));
    const { notify } = configurar({
      getInventario: () =>
        of({
          status: 'OK',
          data: [
            {
              id: 1,
              codigo: 'INV-1',
              nombre: 'Pala',
              descripcion: null,
              cantidad: 3,
              valor_unitario: 12.5,
              fecha_adquisicion: null,
              estado_fisico: 'BUENO',
              ubicacion: null,
            },
            {
              id: 2,
              codigo: null,
              nombre: 'Motoguadaña',
              descripcion: null,
              cantidad: 1,
              valor_unitario: 420,
              fecha_adquisicion: null,
              estado_fisico: 'MALO',
              ubicacion: null,
            },
          ],
        }),
      registrarBien,
    });
    const c = TestBed.createComponent(InventarioComponent).componentInstance;
    expect(c.valorTotal()).toBe(457.5);
    expect(c.etiquetaEstado('DADO_DE_BAJA')).toBe('Dado de baja');

    c.abrir();
    c.guardar();
    expect(notify.warning).toHaveBeenCalled();
    expect(registrarBien).not.toHaveBeenCalled();
    c.form.nombre = ' Carretilla ';
    c.form.valor_unitario = 65;
    c.guardar();
    expect(registrarBien).toHaveBeenCalledWith(
      expect.objectContaining({ nombre: 'Carretilla', cantidad: 1, valor_unitario: 65 }),
    );
  });

  it('el inventario edita un bien existente y permite dar de baja (H-03)', () => {
    const actualizarBien = vi.fn(() => of({ status: 'OK' as const, data: null }));
    const registrarBien = vi.fn();
    configurar({ actualizarBien, registrarBien });
    const c = TestBed.createComponent(InventarioComponent).componentInstance;
    c.editar({
      id: 7,
      codigo: 'INV-7',
      nombre: 'Bomba',
      descripcion: null,
      cantidad: 2,
      valor_unitario: 300,
      fecha_adquisicion: null,
      estado_fisico: 'MALO',
      ubicacion: null,
    });
    expect(c.editandoId()).toBe(7);
    expect(c.form.codigo).toBe('INV-7');
    c.form.estado_fisico = 'DADO_DE_BAJA';
    c.form.cantidad = 0;
    c.guardar();
    expect(registrarBien).not.toHaveBeenCalled();
    expect(actualizarBien).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ nombre: 'Bomba', cantidad: 0, estado_fisico: 'DADO_DE_BAJA' }),
    );
    c.abrir();
    expect(c.editandoId()).toBeNull();
  });

  it('una actividad cumplida exige fecha de cumplimiento y se actualiza por PATCH (H-04)', () => {
    const actualizarActividad = vi.fn(() => of({ status: 'OK' as const, data: null }));
    const { notify } = configurar({ actualizarActividad });
    const c = TestBed.createComponent(PlanAnualComponent).componentInstance;
    const actividad = {
      id: 11,
      plan_id: 4,
      nombre: 'Limpieza del canal',
      descripcion: null,
      fecha_inicio: '2026-05-01',
      fecha_fin: '2026-05-31',
      estado: 'PENDIENTE' as const,
      fecha_cumplimiento: null,
      observacion_resultado: null,
    };
    const plan = {
      id: 4,
      anio: 2026,
      descripcion: null,
      estado: 'ACTIVO' as const,
      actividades: [actividad],
    };
    c.editarActividad(plan, actividad);
    expect(c.editandoId()).toBe(11);
    c.edicion.estado = 'CUMPLIDA';
    c.guardarActividad(plan);
    expect(notify.warning).toHaveBeenCalled();
    expect(actualizarActividad).not.toHaveBeenCalled();
    c.edicion.fecha_cumplimiento = '2026-05-20';
    c.edicion.observacion_resultado = ' Participaron 40 usuarios ';
    c.guardarActividad(plan);
    expect(actualizarActividad).toHaveBeenCalledWith(
      4,
      11,
      expect.objectContaining({
        estado: 'CUMPLIDA',
        fecha_cumplimiento: '2026-05-20',
        observacion_resultado: 'Participaron 40 usuarios',
      }),
    );
  });

  it('una actividad del plan exige nombre y fechas en orden', () => {
    const agregarActividad = vi.fn(() => of({ status: 'OK' as const, data: null, actividadId: 9 }));
    const { notify } = configurar({ agregarActividad });
    const c = TestBed.createComponent(PlanAnualComponent).componentInstance;
    const plan = {
      id: 4,
      anio: 2026,
      descripcion: null,
      estado: 'ACTIVO' as const,
      actividades: [],
    };
    c.abrirActividad(plan);
    expect(c.actividad.fecha_inicio).toBe('2026-01-01');
    c.actividad.nombre = 'Limpieza del canal';
    c.actividad.fecha_inicio = '2026-05-01';
    c.actividad.fecha_fin = '2026-04-01';
    c.guardarActividad(plan);
    expect(notify.warning).toHaveBeenCalled();
    c.actividad.fecha_fin = '2026-05-31';
    c.guardarActividad(plan);
    expect(agregarActividad).toHaveBeenCalledWith(
      4,
      expect.objectContaining({
        nombre: 'Limpieza del canal',
        fecha_inicio: '2026-05-01',
        fecha_fin: '2026-05-31',
      }),
    );
  });
});
