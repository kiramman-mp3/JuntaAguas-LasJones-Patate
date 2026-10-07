import { Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ComunerosAdminComponent } from './comuneros-admin.component';

const notifyStub = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() } as any;
const dialogStub = { confirmar: vi.fn(async () => true), solicitar: vi.fn(), aviso: vi.fn() } as any;
const cdrStub = { detectChanges: vi.fn() } as any;

describe('Código de nuevo lote', () => {
  it('descarta una sugerencia tardía después de cambiar el sector', () => {
    const respuesta = new Subject();
    const admin = { sugerirCodigoLote: vi.fn(() => respuesta) };
    const component = new ComunerosAdminComponent(admin as any, cdrStub, notifyStub, dialogStub);
    component.modalLoteVisible = true;
    component.formLote.sector_id = 1;
    component.sugerirCodigoLote();
    component.formLote.sector_id = 2;
    component.cambiarSectorLote();
    component.formLote.codigo = 'ELT-003';
    respuesta.next({ data: { codigo: 'LJA-001' } });
    expect(component.formLote.codigo).toBe('ELT-003');
    expect(component.sugiriendoCodigoLote).toBe(false);
  });

  it('descarta respuestas tras cerrar el formulario', () => {
    const respuesta = new Subject();
    const component = new ComunerosAdminComponent(
      { sugerirCodigoLote: () => respuesta } as any,
      cdrStub,
      notifyStub,
      dialogStub,
    );
    component.modalLoteVisible = true;
    component.formLote.sector_id = 1;
    component.sugerirCodigoLote();
    component.cerrarModalLote();
    respuesta.next({ data: { codigo: 'LJA-002' } });
    expect(component.formLote.codigo).toBe('');
  });

  it('mantiene el formulario editable y muestra el conflicto devuelto por el servidor', () => {
    const admin = {
      createLote: vi.fn(() => throwError(() => ({ error: { message: 'Código ya registrado' } }))),
    };
    const component = new ComunerosAdminComponent(admin as any, cdrStub, notifyStub, dialogStub);
    component.modalLoteVisible = true;
    component.formLote.sector_id = 1;
    component.formLote.codigo = ' lja-001 ';
    component.guardarLote();
    expect(component.formLote.codigo).toBe('LJA-001');
    expect(component.modalLoteVisible).toBe(true);
    expect(component.guardandoLote).toBe(false);
    expect(component.errorLote).toBe('Código ya registrado');
  });
});

describe('Contraseña temporal de cuentas', () => {
  const nuevoComunero = (component: ComunerosAdminComponent) => {
    component.abrirModalNuevoUsuario();
    Object.assign(component.formUsuario, { cedula: '1803456789', nombres: 'Rosa Elena', apellidos: 'Caiza Toapanta' });
  };

  it('envía el rol como código y muestra la contraseña temporal al crear el comunero', () => {
    const admin = { createPersona: vi.fn(() => of({ status: 'OK', passwordTemporal: 'Kx7pQ2mR9a' })), getPersonas: vi.fn(() => of({ data: [] })) };
    const component = new ComunerosAdminComponent(admin as any, cdrStub, notifyStub, dialogStub);
    nuevoComunero(component);
    component.guardarUsuario();
    expect((admin.createPersona.mock.calls[0] as any[])[0]).toMatchObject({ crearCuenta: true, rol: 'USUARIO' });
    expect(component.credencialTemporal).toEqual({ nombre: 'Rosa Elena Caiza Toapanta', cedula: '1803456789', password: 'Kx7pQ2mR9a' });
    component.cerrarCredencial();
    expect(component.credencialTemporal).toBeNull();
  });

  it('restablece la contraseña tras confirmar y muestra la nueva', async () => {
    const admin = { restablecerPassword: vi.fn(() => of({ status: 'OK', message: '', passwordTemporal: 'Nueva7Temp' })) };
    const component = new ComunerosAdminComponent(admin as any, cdrStub, notifyStub, dialogStub);
    component.abrirModalEditarUsuario({ id: 9, cedula: '1803456789', nombres: 'Rosa', apellidos: 'Caiza', cuenta_estado: 'ACTIVA', rol: 'USUARIO' });
    expect(component.cuentaUsuario).toEqual({ estado: 'ACTIVA', rol: 'USUARIO' });
    await component.restablecerPasswordUsuario();
    expect(admin.restablecerPassword).toHaveBeenCalledWith(9);
    expect(component.credencialTemporal?.password).toBe('Nueva7Temp');
  });

  it('crea la cuenta de un comunero que no la tenía', () => {
    const admin = { crearCuenta: vi.fn(() => of({ status: 'OK', message: '', passwordTemporal: 'Cuenta9New' })), getPersonas: vi.fn(() => of({ data: [] })) };
    const component = new ComunerosAdminComponent(admin as any, cdrStub, notifyStub, dialogStub);
    component.abrirModalEditarUsuario({ id: 4, cedula: '1803456789', nombres: 'Luis', apellidos: 'Aldaz' });
    expect(component.cuentaUsuario).toBeNull();
    component.crearCuentaUsuario();
    expect(admin.crearCuenta).toHaveBeenCalledWith(4, 'USUARIO');
    expect(component.cuentaUsuario).toEqual({ estado: 'ACTIVA', rol: 'USUARIO' });
    expect(component.credencialTemporal?.password).toBe('Cuenta9New');
  });
});
