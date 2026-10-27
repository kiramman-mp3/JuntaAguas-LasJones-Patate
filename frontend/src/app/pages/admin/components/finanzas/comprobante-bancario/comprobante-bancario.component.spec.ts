import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ComprobanteBancarioComponent } from './comprobante-bancario.component';
import { FinanzasService } from '../../../../../core/services/finanzas.service';
import { DialogService } from '../../../../../core/services/dialog.service';
import { NotificationService } from '../../../../../core/services/notification.service';

describe('Comprobante bancario', () => {
  function crear(existente = false) {
    const api = {
      subirComprobante: vi.fn(() => of({ status: 'OK' })),
      descargarComprobante: vi.fn(),
    };
    const notify = { success: vi.fn(), error: vi.fn(), warning: vi.fn() };
    const dialog = { confirmar: vi.fn().mockResolvedValue(true) };
    TestBed.configureTestingModule({
      providers: [
        { provide: FinanzasService, useValue: api },
        { provide: NotificationService, useValue: notify },
        { provide: DialogService, useValue: dialog },
      ],
    });
    const fixture = TestBed.createComponent(ComprobanteBancarioComponent);
    fixture.componentRef.setInput('pagoId', 42);
    fixture.componentRef.setInput('existente', existente);
    return { c: fixture.componentInstance, fixture, api, notify, dialog };
  }
  const entrada = (file: File) =>
    ({ files: [file], value: 'archivo' }) as unknown as HTMLInputElement;
  const pdf = () => new File(['%PDF-1.4'], 'banco.pdf', { type: 'application/pdf' });

  it('adjunta al pago registrado y permite descargar después de subir', async () => {
    const { c, api } = crear();
    const file = pdf();
    const input = entrada(file);
    await c.subir(input);
    expect(api.subirComprobante).toHaveBeenCalledWith(42, file, 'GENERAL');
    expect(input.value).toBe('');
    expect(c.existe()).toBe(true);
    expect(c.ocupado()).toBe(false);
  });

  it('rechaza tipos y tamaños inválidos sin enviar el archivo', async () => {
    const { c, api, notify } = crear();
    await c.subir(entrada(new File(['texto'], 'archivo.txt', { type: 'text/plain' })));
    await c.subir(
      entrada(
        new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'grande.pdf', { type: 'application/pdf' }),
      ),
    );
    expect(api.subirComprobante).not.toHaveBeenCalled();
    expect(notify.warning).toHaveBeenCalledTimes(2);
  });

  it('cancelar el reemplazo conserva el adjunto', async () => {
    const { c, api, dialog } = crear(true);
    dialog.confirmar.mockResolvedValue(false);
    await c.subir(entrada(pdf()));
    expect(api.subirComprobante).not.toHaveBeenCalled();
    expect(c.existe()).toBe(true);
    expect(c.ocupado()).toBe(false);
  });

  it('permite reintentar una carga fallida sin volver a registrar un pago', async () => {
    const { c, api, notify } = crear();
    api.subirComprobante.mockReturnValueOnce(throwError(() => new Error('Red')));
    await c.subir(entrada(pdf()));
    expect(c.existe()).toBe(false);
    expect(c.ocupado()).toBe(false);
    expect(notify.error).toHaveBeenCalled();
    await c.subir(entrada(pdf()));
    expect(c.existe()).toBe(true);
    expect(api.subirComprobante).toHaveBeenCalledTimes(2);
  });

  it('bloquea cargas simultáneas y la edición de pagos anulados', async () => {
    const { c, api, fixture } = crear();
    const pendiente = new Subject<{ status: string }>();
    api.subirComprobante.mockReturnValue(pendiente);
    const primera = c.subir(entrada(pdf()));
    await c.subir(entrada(pdf()));
    expect(api.subirComprobante).toHaveBeenCalledTimes(1);
    pendiente.complete();
    await primera;
    fixture.componentRef.setInput('editable', false);
    await c.subir(entrada(pdf()));
    expect(api.subirComprobante).toHaveBeenCalledTimes(1);
  });
});
