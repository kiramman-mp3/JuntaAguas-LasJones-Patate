import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Gestioncontratacion } from './gestioncontratacion';

describe('Gestioncontratacion', () => {
  let component: Gestioncontratacion;
  let fixture: ComponentFixture<Gestioncontratacion>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Gestioncontratacion],
    }).compileComponents();

    fixture = TestBed.createComponent(Gestioncontratacion);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

describe('Egresos sin diálogos nativos', () => {
  const crear = (admin: Record<string, any> = {}) => {
    const notify = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
    const component = new Gestioncontratacion(
      { getEgresos: () => of({ data: [] }), ...admin } as any, { markForCheck: vi.fn() } as any, notify as any
    );
    return { component, notify };
  };

  beforeEach(() => vi.spyOn(window, 'alert').mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it('valida el formulario con avisos no bloqueantes', () => {
    const { component, notify } = crear();
    component.nuevoEgreso.fecha = '2026-10-06';
    component.nuevoEgreso.concepto = 'Compra de cemento';
    component.nuevoEgreso.valor = 0 as any;
    component.guardarEgreso();
    expect(notify.warning).toHaveBeenCalledWith('Por favor ingresa un monto válido mayor a cero.');
    expect(window.alert).not.toHaveBeenCalled();
  });

  it('confirma el registro y muestra los errores del servidor', () => {
    const registrarEgreso = vi.fn(() => of({ message: 'Egreso registrado.' }));
    const { component, notify } = crear({ registrarEgreso });
    Object.assign(component.nuevoEgreso, { fecha: '2026-10-06', concepto: 'Compra de cemento', valor: 45 });
    component.guardarEgreso();
    expect(notify.success).toHaveBeenCalledWith('Egreso registrado.');

    const fallo = crear({ registrarEgreso: () => throwError(() => ({ error: { message: 'Fecha inválida.' } })) });
    Object.assign(fallo.component.nuevoEgreso, { fecha: '2026-10-06', concepto: 'Compra', valor: 10 });
    fallo.component.guardarEgreso();
    expect(fallo.notify.error).toHaveBeenCalledWith('Fecha inválida.');
    expect(window.alert).not.toHaveBeenCalled();
  });
});
