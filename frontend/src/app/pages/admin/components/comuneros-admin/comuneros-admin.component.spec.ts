import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminService } from '../../../../core/services/admin.service';
import { DialogService } from '../../../../core/services/dialog.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { LoteFormComponent } from './lote-form/lote-form.component';
import { ComuneroFormComponent } from './comunero-form/comunero-form.component';
import { LotesComuneroComponent } from './lotes-comunero/lotes-comunero.component';
import { VincularLoteComponent } from './vincular-lote/vincular-lote.component';

let admin: any;
const notifyStub = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
const dialogStub = { confirmar: vi.fn(async () => true), solicitar: vi.fn(), aviso: vi.fn() };

const configurar = (adminMock: any) => {
  admin = adminMock;
  TestBed.configureTestingModule({
    providers: [
      { provide: AdminService, useValue: admin },
      { provide: NotificationService, useValue: notifyStub },
      { provide: DialogService, useValue: dialogStub }
    ]
  });
};

describe('Código de nuevo lote (LoteFormComponent)', () => {
  it('descarta una sugerencia tardía después de cambiar el sector', () => {
    const respuesta = new Subject();
    configurar({ sugerirCodigoLote: vi.fn(() => respuesta) });
    const component = TestBed.createComponent(LoteFormComponent).componentInstance;
    component.form.sector_id = 1;
    component.sugerirCodigo();
    component.form.sector_id = 2;
    component.cambiarSector();
    component.form.codigo = 'ELT-003';
    respuesta.next({ data: { codigo: 'LJA-001' } });
    expect(component.form.codigo).toBe('ELT-003');
    expect(component.sugiriendoCodigo).toBe(false);
  });

  it('descarta respuestas tras cerrar el formulario', () => {
    const respuesta = new Subject();
    configurar({ sugerirCodigoLote: () => respuesta });
    const component = TestBed.createComponent(LoteFormComponent).componentInstance;
    const cerrar = vi.fn();
    component.cerrar.subscribe(cerrar);
    component.form.sector_id = 1;
    component.sugerirCodigo();
    component.solicitarCierre();
    respuesta.next({ data: { codigo: 'LJA-002' } });
    expect(cerrar).toHaveBeenCalled();
    expect(component.form.codigo).toBe('');
  });

  it('mantiene el formulario editable y muestra el conflicto devuelto por el servidor', () => {
    configurar({ createLote: vi.fn(() => throwError(() => ({ error: { message: 'Código ya registrado' } }))) });
    const component = TestBed.createComponent(LoteFormComponent).componentInstance;
    const creado = vi.fn();
    component.creado.subscribe(creado);
    component.form.sector_id = 1;
    component.form.codigo = ' lja-001 ';
    component.guardar();
    expect(component.form.codigo).toBe('LJA-001');
    expect(creado).not.toHaveBeenCalled();
    expect(component.guardando).toBe(false);
    expect(component.error).toBe('Código ya registrado');
  });

  it('rechaza un código con formato inválido sin llamar al servidor', () => {
    configurar({ createLote: vi.fn() });
    const component = TestBed.createComponent(LoteFormComponent).componentInstance;
    component.form.sector_id = 1;
    component.form.codigo = 'LJ-1';
    component.guardar();
    expect(admin.createLote).not.toHaveBeenCalled();
    expect(component.error).toContain('LJA-001');
  });
});

describe('Contraseña temporal de cuentas (ComuneroFormComponent)', () => {
  const crear = (comunero: any = null) => {
    const fixture = TestBed.createComponent(ComuneroFormComponent);
    fixture.componentRef.setInput('comunero', comunero);
    fixture.componentInstance.ngOnInit();
    return fixture.componentInstance;
  };

  it('envía el rol como código y muestra la contraseña temporal al crear el comunero', () => {
    configurar({ createPersona: vi.fn(() => of({ status: 'OK', passwordTemporal: 'Kx7pQ2mR9a' })) });
    const component = crear();
    const guardado = vi.fn();
    component.guardado.subscribe(guardado);
    Object.assign(component.form, { cedula: '1803456789', nombres: 'Rosa Elena', apellidos: 'Caiza Toapanta' });
    component.guardar();
    expect((admin.createPersona.mock.calls[0] as any[])[0]).toMatchObject({ crearCuenta: true, rol: 'USUARIO' });
    expect(component.credencialTemporal).toEqual({ nombre: 'Rosa Elena Caiza Toapanta', cedula: '1803456789', password: 'Kx7pQ2mR9a' });
    expect(component.ocultarFormulario).toBe(true);
    // El formulario termina solo cuando el administrador confirma que anotó la contraseña.
    expect(guardado).not.toHaveBeenCalled();
    component.cerrarCredencial();
    expect(component.credencialTemporal).toBeNull();
    expect(guardado).toHaveBeenCalledOnce();
  });

  it('restablece la contraseña tras confirmar y muestra la nueva', async () => {
    configurar({ restablecerPassword: vi.fn(() => of({ status: 'OK', message: '', passwordTemporal: 'Nueva7Temp' })) });
    const component = crear({ id: 9, cedula: '1803456789', nombres: 'Rosa', apellidos: 'Caiza', cuenta_estado: 'ACTIVA', rol: 'USUARIO' });
    expect(component.cuenta).toEqual({ estado: 'ACTIVA', rol: 'USUARIO' });
    await component.restablecerPassword();
    expect(admin.restablecerPassword).toHaveBeenCalledWith(9);
    expect(component.credencialTemporal?.password).toBe('Nueva7Temp');
  });

  it('crea la cuenta de un comunero que no la tenía', () => {
    configurar({ crearCuenta: vi.fn(() => of({ status: 'OK', message: '', passwordTemporal: 'Cuenta9New' })) });
    const component = crear({ id: 4, cedula: '1803456789', nombres: 'Luis', apellidos: 'Aldaz' });
    expect(component.cuenta).toBeNull();
    component.crearCuenta();
    expect(admin.crearCuenta).toHaveBeenCalledWith(4, 'USUARIO');
    expect(component.cuenta).toEqual({ estado: 'ACTIVA', rol: 'USUARIO' });
    expect(component.credencialTemporal?.password).toBe('Cuenta9New');
  });
});

describe('Titularidad única (VincularLoteComponent)', () => {
  const comunero = { id: 3, nombres: 'Ana', apellidos: 'Pérez', cedula: '1800000001' };
  const crear = () => {
    const fixture = TestBed.createComponent(VincularLoteComponent);
    fixture.componentRef.setInput('comunero', comunero);
    fixture.componentInstance.ngOnInit();
    return fixture.componentInstance;
  };

  beforeEach(() => configurar({
    getLotes: vi.fn(() => of({ data: [
      { id: 10, codigo: 'LJA-010', propietario_id: 8, propietario_nombre: 'Luis Mora', propietarios: 'Luis Mora' },
      { id: 11, codigo: 'LJA-011' },
      { id: 12, codigo: 'LJA-012', propietario_id: 3, propietario_nombre: 'Ana Pérez', propietarios: 'Ana Pérez' }
    ] })),
    vincularPersonaLote: vi.fn(() => of({ status: 'OK', message: 'Titularidad transferida' }))
  }));

  it('siempre asigna el 100 % de la propiedad, sin porcentajes parciales', () => {
    const c = crear();
    c.loteId.set(11);
    c.guardar();
    expect(admin.vincularPersonaLote).toHaveBeenCalledWith(11, { persona_id: 3, tipo_relacion: 'PROPIETARIO', porcentaje: 100 });
  });

  it('advierte que asignar un lote con dueño transfiere la propiedad completa', () => {
    const c = crear();
    c.loteId.set(10);
    expect(c.titularActual()).toBe('Luis Mora');
    c.loteId.set(11);
    expect(c.titularActual()).toBeNull();
    c.loteId.set(12);
    expect(c.titularActual()).toBeNull();
  });
});

describe('Lotes de un comunero (LotesComuneroComponent)', () => {
  beforeEach(() => configurar({ getLotes: vi.fn(() => of({ data: [] })) }));

  it('muestra el estado vacío cuando el comunero no tiene lotes en lugar de quedarse cargando', () => {
    const fixture = TestBed.createComponent(LotesComuneroComponent);
    fixture.componentRef.setInput('comunero', { id: 3, nombres: 'Ana', apellidos: 'Pérez', cedula: '1800000001' });
    fixture.componentInstance.ngOnInit();
    expect(admin.getLotes).toHaveBeenCalledWith(undefined, undefined, 3);
    expect(fixture.componentInstance.cargando()).toBe(false);
    expect(fixture.componentInstance.lotes()).toEqual([]);
  });
});
