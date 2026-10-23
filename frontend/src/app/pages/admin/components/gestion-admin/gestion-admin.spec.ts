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
          getAuditoria: () => of({ status: 'OK', data: [] }),
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
    const getAuditoria = vi.fn(() => of({ status: 'OK' as const, data: [] }));
    configurar({ getAuditoria });
    const c = TestBed.createComponent(AuditoriaComponent).componentInstance;
    expect(getAuditoria).toHaveBeenCalledWith(
      expect.objectContaining({ desde: c.desde(), hasta: c.hasta(), limit: 100 }),
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
