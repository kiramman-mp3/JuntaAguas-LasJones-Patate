import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminService } from '../../../../core/services/admin.service';
import { DialogService } from '../../../../core/services/dialog.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { TurnosAdminComponent } from './turnos-admin.component';
import { TurnoAsignarComponent } from './turno-asignar/turno-asignar.component';

const turnosApi = [
  { id: 1, persona_id: 7, lote_id: 3, dia_semana: 1, hora_inicio: '08:00:00', hora_fin: '10:00:00', tipo: 'REGULAR', comunero_nombre: 'Ana Pérez', lote_codigo: 'LJA-001', sector_nombre: 'La Merced' },
  { id: 2, persona_id: 8, lote_id: 4, dia_semana: 3, hora_inicio: '14:00:00', hora_fin: '16:00:00', tipo: 'ADICIONAL', nombres: 'Luis', apellidos: 'Mora', lote_codigo: 'LJA-002', sector_nombre: 'Centro' }
];

describe('Turnos de agua', () => {
  let admin: any;
  let dialog: any;
  let notify: any;

  beforeEach(() => {
    admin = {
      getTurnos: vi.fn(() => of({ data: turnosApi })),
      eliminarTurno: vi.fn(() => of({ message: 'Eliminado' })),
      asignarTurno: vi.fn(() => of({ message: 'Asignado' })),
      getPersonas: vi.fn(() => of({ data: [], pagination: { total: 0 } })),
      getLotes: vi.fn(() => of({ data: [{ id: 3, codigo: 'LJA-001' }] }))
    };
    dialog = { confirmar: vi.fn(async () => true) };
    notify = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        { provide: AdminService, useValue: admin },
        { provide: DialogService, useValue: dialog },
        { provide: NotificationService, useValue: notify }
      ]
    });
  });

  it('normaliza los turnos de la API y filtra por texto, día y tipo', () => {
    const component = TestBed.createComponent(TurnosAdminComponent).componentInstance;
    component.cargar();
    expect(component.turnos().map((t) => [t.usuario, t.dia, t.horaInicio])).toEqual([
      ['Ana Pérez', 'Lunes', '08:00'],
      ['Luis Mora', 'Miércoles', '14:00']
    ]);
    component.busqueda.set('centro');
    expect(component.filtrados().map((t) => t.id)).toEqual([2]);
    component.limpiarFiltros();
    component.diaFiltro.set('Lunes');
    expect(component.filtrados().map((t) => t.id)).toEqual([1]);
    component.diaFiltro.set('');
    component.tipoFiltro.set('ADICIONAL');
    expect(component.filtrados().map((t) => t.id)).toEqual([2]);
  });

  it('elimina un turno solo tras confirmar y lo quita de la lista sin recargar', async () => {
    const component = TestBed.createComponent(TurnosAdminComponent).componentInstance;
    component.cargar();
    dialog.confirmar.mockResolvedValueOnce(false);
    await component.eliminar(component.turnos()[0]);
    expect(admin.eliminarTurno).not.toHaveBeenCalled();

    await component.eliminar(component.turnos()[0]);
    expect(admin.eliminarTurno).toHaveBeenCalledWith(1);
    expect(component.turnos().map((t) => t.id)).toEqual([2]);
    expect(admin.getTurnos).toHaveBeenCalledTimes(1);
  });

  it('al seleccionar un comunero propone su primer lote y valida el horario', () => {
    const component = TestBed.createComponent(TurnoAsignarComponent).componentInstance;
    component.seleccionar({ id: 7, nombres: 'Ana', apellidos: 'Pérez', cedula: '1800000001' });
    expect(admin.getLotes).toHaveBeenCalledWith(undefined, undefined, 7);
    expect(component.turno.lote_id).toBe(3);

    component.turno.hora_inicio = '10:00';
    component.turno.hora_fin = '09:00';
    component.guardar();
    expect(notify.warning).toHaveBeenCalled();
    expect(admin.asignarTurno).not.toHaveBeenCalled();
  });
});
