import { TestBed } from '@angular/core/testing';
import { DialogService } from './dialog.service';

describe('DialogService', () => {
  const validar = (texto: string) =>
    texto.trim().length < 5 ? 'Describa el motivo con al menos 5 caracteres.' : null;

  function crear(): DialogService {
    TestBed.configureTestingModule({});
    return TestBed.inject(DialogService);
  }

  it('un texto que no pasa la validación mantiene el diálogo abierto y conserva lo escrito (H-15)', async () => {
    const dialog = crear();
    const respuesta = dialog.solicitar({
      titulo: 'Anular',
      mensaje: 'Motivo',
      placeholder: 'Motivo',
      validar,
    });

    dialog.setValor('abc');
    dialog.responder(true);
    expect(dialog.estado().visible).toBe(true);
    expect(dialog.estado().valor).toBe('abc');
    expect(dialog.estado().error).toContain('5 caracteres');

    dialog.setValor('Error de digitación');
    expect(dialog.estado().error).toBe('');
    dialog.responder(true);
    expect(dialog.estado().visible).toBe(false);
    expect(await respuesta).toBe('Error de digitación');
  });

  it('cancelar cierra el diálogo aunque el texto no sea válido', async () => {
    const dialog = crear();
    const respuesta = dialog.solicitar({
      titulo: 'Anular',
      mensaje: 'Motivo',
      placeholder: 'Motivo',
      validar,
    });

    dialog.setValor('ab');
    dialog.responder(false);
    expect(dialog.estado().visible).toBe(false);
    expect(await respuesta).toBeNull();
  });

  it('sin validación el comportamiento no cambia', async () => {
    const dialog = crear();
    const respuesta = dialog.solicitar({
      titulo: 'Nombre',
      mensaje: 'Indique',
      placeholder: 'Nombre',
    });
    dialog.setValor('x');
    dialog.responder(true);
    expect(await respuesta).toBe('x');
  });
});
