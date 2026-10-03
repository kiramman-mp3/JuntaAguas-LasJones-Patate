import { Subject, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ComunerosAdminComponent } from './comuneros-admin.component';

describe('Código de nuevo lote', () => {
  it('descarta una sugerencia tardía después de cambiar el sector', () => {
    const respuesta = new Subject();
    const admin = { sugerirCodigoLote: vi.fn(() => respuesta) };
    const component = new ComunerosAdminComponent(admin as any, { detectChanges: vi.fn() } as any);
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
      { detectChanges: vi.fn() } as any,
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
    const component = new ComunerosAdminComponent(admin as any, { detectChanges: vi.fn() } as any);
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
