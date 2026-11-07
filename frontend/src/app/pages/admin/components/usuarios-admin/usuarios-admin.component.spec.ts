import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminService } from '../../../../core/services/admin.service';
import { DialogService } from '../../../../core/services/dialog.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { LoteFormComponent } from './lote-form/lote-form.component';
import { UsuarioFormComponent } from './usuario-form/usuario-form.component';
import { LotesUsuarioComponent } from './lotes-usuario/lotes-usuario.component';
import { VincularLoteComponent } from './vincular-lote/vincular-lote.component';
import { SectorFormComponent } from './sector-form/sector-form.component';
import { PadronUsuariosComponent } from './padron/padron-usuarios.component';
import { CatastroLotesComponent } from './catastro/catastro-lotes.component';

let admin: any;
const notifyStub = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
const dialogStub = { confirmar: vi.fn(async () => true), solicitar: vi.fn(), aviso: vi.fn() };

const configurar = (adminMock: any) => {
  admin = adminMock;
  TestBed.configureTestingModule({
    providers: [
      { provide: AdminService, useValue: admin },
      { provide: NotificationService, useValue: notifyStub },
      { provide: DialogService, useValue: dialogStub },
    ],
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
    configurar({
      createLote: vi.fn(() => throwError(() => ({ error: { message: 'Código ya registrado' } }))),
    });
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

describe('Edición de un lote (LoteFormComponent)', () => {
  const lote = {
    id: 7,
    sector_id: 2,
    sector_nombre: 'La Merced',
    codigo: 'LJB-007',
    superficie_m2: '1500.00',
    latitud_aproximada: '-1.329025',
    longitud_aproximada: '-78.510492',
    radio_error_m: 12,
    referencia_ubicacion: 'Junto al tanque',
    observacion: null,
  };

  const crear = () => {
    const fixture = TestBed.createComponent(LoteFormComponent);
    fixture.componentRef.setInput('lote', lote);
    fixture.componentInstance.ngOnInit();
    return fixture.componentInstance;
  };

  it('precarga los datos del lote y la ubicación inicial del mapa', () => {
    configurar({ updateLote: vi.fn() });
    const component = crear();
    expect(component.modoEdicion).toBe(true);
    expect(component.form.codigo).toBe('LJB-007');
    expect(component.form.superficie_m2).toBe(1500);
    expect(component.form.observacion).toBe('');
    expect(component.latInicial).toBeCloseTo(-1.329025);
    expect(component.lngInicial).toBeCloseTo(-78.510492);
  });

  it('actualiza el lote existente en vez de crear uno nuevo', () => {
    configurar({ updateLote: vi.fn(() => of({ status: 'OK' })), createLote: vi.fn() });
    const component = crear();
    const actualizado = vi.fn();
    component.actualizado.subscribe(actualizado);
    component.form.superficie_m2 = 1800;
    component.guardar();
    expect(admin.updateLote).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ superficie_m2: 1800 }),
    );
    expect(admin.createLote).not.toHaveBeenCalled();
    expect(actualizado).toHaveBeenCalled();
  });

  it('muestra el error del servidor y no cierra si falla la actualización', () => {
    configurar({
      updateLote: vi.fn(() => throwError(() => ({ error: { message: 'Código duplicado' } }))),
    });
    const component = crear();
    const actualizado = vi.fn();
    component.actualizado.subscribe(actualizado);
    component.guardar();
    expect(actualizado).not.toHaveBeenCalled();
    expect(component.guardando).toBe(false);
    expect(component.error).toBe('Código duplicado');
  });
});

describe('Contraseña temporal de cuentas (UsuarioFormComponent)', () => {
  const crear = (usuario: any = null) => {
    const fixture = TestBed.createComponent(UsuarioFormComponent);
    fixture.componentRef.setInput('usuario', usuario);
    fixture.componentInstance.ngOnInit();
    return fixture.componentInstance;
  };

  it('envía el rol como código y muestra la contraseña temporal al crear el usuario', () => {
    configurar({
      createPersona: vi.fn(() => of({ status: 'OK', passwordTemporal: 'Kx7pQ2mR9a' })),
    });
    const component = crear();
    const guardado = vi.fn();
    component.guardado.subscribe(guardado);
    Object.assign(component.form, {
      cedula: '1710034065',
      nombres: 'Rosa Elena',
      apellidos: 'Caiza Toapanta',
    });
    component.guardar();
    expect((admin.createPersona.mock.calls[0] as any[])[0]).toMatchObject({
      crearCuenta: true,
      rol: 'USUARIO',
    });
    expect(component.credencialTemporal).toEqual({
      nombre: 'Rosa Elena Caiza Toapanta',
      cedula: '1710034065',
      password: 'Kx7pQ2mR9a',
    });
    expect(component.ocultarFormulario).toBe(true);
    // El formulario termina solo cuando el administrador confirma que anotó la contraseña.
    expect(guardado).not.toHaveBeenCalled();
    component.cerrarCredencial();
    expect(component.credencialTemporal).toBeNull();
    expect(guardado).toHaveBeenCalledOnce();
  });

  it('restablece la contraseña tras confirmar y muestra la nueva', async () => {
    configurar({
      restablecerPassword: vi.fn(() =>
        of({ status: 'OK', message: '', passwordTemporal: 'Nueva7Temp' }),
      ),
    });
    const component = crear({
      id: 9,
      cedula: '1710034065',
      nombres: 'Rosa',
      apellidos: 'Caiza',
      cuenta_estado: 'ACTIVA',
      rol: 'USUARIO',
    });
    expect(component.cuenta).toEqual({ estado: 'ACTIVA', rol: 'USUARIO' });
    await component.restablecerPassword();
    expect(admin.restablecerPassword).toHaveBeenCalledWith(9);
    expect(component.credencialTemporal?.password).toBe('Nueva7Temp');
  });

  it('crea la cuenta de un usuario que no la tenía', () => {
    configurar({
      crearCuenta: vi.fn(() => of({ status: 'OK', message: '', passwordTemporal: 'Cuenta9New' })),
    });
    const component = crear({ id: 4, cedula: '1710034065', nombres: 'Luis', apellidos: 'Aldaz' });
    expect(component.cuenta).toBeNull();
    component.crearCuenta();
    expect(admin.crearCuenta).toHaveBeenCalledWith(4, 'USUARIO');
    expect(component.cuenta).toEqual({ estado: 'ACTIVA', rol: 'USUARIO' });
    expect(component.credencialTemporal?.password).toBe('Cuenta9New');
  });

  it('no guarda un usuario nuevo con una cédula de dígito verificador inválido (H-14)', () => {
    configurar({ createPersona: vi.fn(() => of({ status: 'OK' })) });
    const component = crear();
    Object.assign(component.form, { cedula: '1710034066', nombres: 'Rosa', apellidos: 'Caiza' });
    expect(component.errorCedula).toContain('no es una cédula');
    component.guardar();
    expect(admin.createPersona).not.toHaveBeenCalled();
    expect(notifyStub.warning).toHaveBeenCalled();
  });

  it('al editar, una cédula antigua inválida sin tocar no bloquea el guardado, pero sí si se cambia a otra inválida', () => {
    configurar({ updatePersona: vi.fn(() => of({ status: 'OK' })) });
    const component = crear({ id: 4, cedula: '1803456789', nombres: 'Luis', apellidos: 'Aldaz' });
    expect(component.errorCedula).toBe('');
    component.guardar();
    expect(admin.updatePersona).toHaveBeenCalledOnce();

    component.form.cedula = '1803456788';
    expect(component.errorCedula).toContain('no es una cédula');
    component.guardar();
    expect(admin.updatePersona).toHaveBeenCalledOnce();
  });
});

describe('Titularidad única (VincularLoteComponent)', () => {
  const usuario = { id: 3, nombres: 'Ana', apellidos: 'Pérez', cedula: '1800000001' };
  const crear = () => {
    const fixture = TestBed.createComponent(VincularLoteComponent);
    fixture.componentRef.setInput('usuario', usuario);
    fixture.componentInstance.ngOnInit();
    return fixture.componentInstance;
  };

  beforeEach(() =>
    configurar({
      getLotes: vi.fn(() =>
        of({
          data: [
            {
              id: 10,
              codigo: 'LJA-010',
              propietario_id: 8,
              propietario_nombre: 'Luis Mora',
              propietarios: 'Luis Mora',
            },
            { id: 11, codigo: 'LJA-011' },
            {
              id: 12,
              codigo: 'LJA-012',
              propietario_id: 3,
              propietario_nombre: 'Ana Pérez',
              propietarios: 'Ana Pérez',
            },
          ],
        }),
      ),
      vincularPersonaLote: vi.fn(() => of({ status: 'OK', message: 'Titularidad transferida' })),
    }),
  );

  it('siempre asigna el 100 % de la propiedad, sin porcentajes parciales', () => {
    const c = crear();
    c.loteId.set(11);
    c.guardar();
    expect(admin.vincularPersonaLote).toHaveBeenCalledWith(11, {
      persona_id: 3,
      tipo_relacion: 'PROPIETARIO',
      porcentaje: 100,
    });
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

  it('filtra los lotes reactivamente por codigo, sector o nombre de usuario', () => {
    const c = crear();
    expect(c.lotesFiltrados().length).toBe(3);

    c.busqueda.set('010');
    expect(c.lotesFiltrados().length).toBe(1);
    expect(c.lotesFiltrados()[0].id).toBe(10);

    c.busqueda.set('Luis Mora');
    expect(c.lotesFiltrados().length).toBe(1);
    expect(c.lotesFiltrados()[0].id).toBe(10);

    c.busqueda.set('no-existe');
    expect(c.lotesFiltrados().length).toBe(0);

    c.busqueda.set('');
    expect(c.lotesFiltrados().length).toBe(3);
  });

  it('filtra los lotes por sector y lo combina con la búsqueda', () => {
    const c = crear();
    c.lotes.set([
      { id: 1, sector_id: 5, sector_nombre: 'La Merced', codigo: 'LJB-001' },
      { id: 2, sector_id: 5, sector_nombre: 'La Merced', codigo: 'LJB-002' },
      { id: 3, sector_id: 9, sector_nombre: 'San Javier', codigo: 'LJB-003' },
    ] as never);
    expect(c.sectores().map((s) => s.nombre)).toEqual(['La Merced', 'San Javier']);

    c.sectorId.set(5);
    expect(c.lotesFiltrados().map((l) => l.id)).toEqual([1, 2]);

    c.busqueda.set('002');
    expect(c.lotesFiltrados().map((l) => l.id)).toEqual([2]);

    c.sectorId.set(9);
    expect(c.lotesFiltrados().length).toBe(0);
  });

  it('mantiene el lote actualmente seleccionado en la lista si no coincide con el filtro', () => {
    const c = crear();
    c.loteId.set(11);
    c.busqueda.set('010');
    expect(c.lotesFiltrados().some((l) => l.id === 11)).toBe(true);
    expect(c.lotesFiltrados().some((l) => l.id === 10)).toBe(true);
  });
});

describe('Sectores (SectorFormComponent)', () => {
  it('crea un sector con su nombre limpio y avisa al terminar', () => {
    configurar({ createSector: vi.fn(() => of({ status: 'OK', message: '', sectorId: 1 })) });
    const c = TestBed.createComponent(SectorFormComponent).componentInstance;
    const creado = vi.fn();
    c.creado.subscribe(creado);
    c.nombre = '  La Jones Alto ';
    c.guardar();
    expect(admin.createSector).toHaveBeenCalledWith({
      nombre: 'La Jones Alto',
      descripcion: undefined,
    });
    expect(creado).toHaveBeenCalled();
  });

  it('muestra el conflicto si el sector ya existe', () => {
    configurar({
      createSector: vi.fn(() =>
        throwError(() => ({ error: { message: 'Ya existe el sector Centro.' } })),
      ),
    });
    const c = TestBed.createComponent(SectorFormComponent).componentInstance;
    c.nombre = 'Centro';
    c.guardar();
    expect(c.error()).toBe('Ya existe el sector Centro.');
    expect(c.guardando()).toBe(false);
  });
});

describe('Lotes de un usuario (LotesUsuarioComponent)', () => {
  beforeEach(() => configurar({ getLotes: vi.fn(() => of({ data: [] })) }));

  it('muestra el estado vacío cuando el usuario no tiene lotes en lugar de quedarse cargando', () => {
    const fixture = TestBed.createComponent(LotesUsuarioComponent);
    fixture.componentRef.setInput('usuario', {
      id: 3,
      nombres: 'Ana',
      apellidos: 'Pérez',
      cedula: '1800000001',
    });
    fixture.componentInstance.ngOnInit();
    expect(admin.getLotes).toHaveBeenCalledWith(undefined, undefined, 3);
    expect(fixture.componentInstance.cargando()).toBe(false);
    expect(fixture.componentInstance.lotes()).toEqual([]);
  });
});

describe('Paginación del padrón (PadronUsuariosComponent)', () => {
  const pagina = (total: number, n = 2) =>
    of({
      data: Array.from({ length: n }, (_, i) => ({ id: i + 1, nombres: 'A', apellidos: 'B' })),
      pagination: { total, page: 1, limit: 25 },
    });

  it('pide la página y la cantidad elegidas al servidor', () => {
    configurar({ getPersonas: vi.fn(() => pagina(60)) });
    const fixture = TestBed.createComponent(PadronUsuariosComponent);
    fixture.detectChanges();
    expect(admin.getPersonas).toHaveBeenLastCalledWith(1, 25, '', '');

    fixture.componentInstance.cambiarPagina(3);
    expect(admin.getPersonas).toHaveBeenLastCalledWith(3, 25, '', '');

    fixture.componentInstance.cambiarPorPagina(50);
    expect(admin.getPersonas).toHaveBeenLastCalledWith(1, 50, '', '');
    expect(fixture.componentInstance.total()).toBe(60);
  });

  it('si la página pedida quedó vacía vuelve a la última con datos', () => {
    configurar({ getPersonas: vi.fn(() => pagina(30)) });
    const fixture = TestBed.createComponent(PadronUsuariosComponent);
    fixture.detectChanges();
    fixture.componentInstance.cambiarPagina(5);
    expect(fixture.componentInstance.pagina()).toBe(2);
    expect(admin.getPersonas).toHaveBeenLastCalledWith(2, 25, '', '');
  });

  it('muestra el paginador con el rango de usuarios', () => {
    configurar({ getPersonas: vi.fn(() => pagina(60)) });
    const fixture = TestBed.createComponent(PadronUsuariosComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Mostrando 1–25 de 60 usuarios');
  });
});

describe('Paginación del catastro (CatastroLotesComponent)', () => {
  const pagina = (total: number) =>
    of({
      data: [{ id: 1, codigo: 'LJA-001', sector_nombre: 'Alto' }],
      pagination: { total, page: 1, limit: 25 },
    });

  it('pide al servidor la página, la cantidad y los filtros', () => {
    configurar({
      getSectores: vi.fn(() => of({ data: [{ id: 4, nombre: 'Alto' }] })),
      getLotesPaginados: vi.fn(() => pagina(80)),
    });
    const fixture = TestBed.createComponent(CatastroLotesComponent);
    fixture.detectChanges();
    const c = fixture.componentInstance;
    expect(admin.getLotesPaginados).toHaveBeenLastCalledWith(1, 25, undefined, '');

    c.cambiarPagina(3);
    expect(admin.getLotesPaginados).toHaveBeenLastCalledWith(3, 25, undefined, '');

    // Cambiar un filtro vuelve a la primera página.
    c.sectorFiltro = 4;
    c.filtrar(true);
    expect(admin.getLotesPaginados).toHaveBeenLastCalledWith(1, 25, 4, '');

    c.cambiarPorPagina(10);
    expect(admin.getLotesPaginados).toHaveBeenLastCalledWith(1, 10, 4, '');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Mostrando 1–10 de 80 lotes');
  });
});
