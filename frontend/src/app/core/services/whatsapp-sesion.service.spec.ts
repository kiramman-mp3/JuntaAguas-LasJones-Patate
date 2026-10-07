import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WhatsAppSesionService } from './whatsapp-sesion.service';
import { AdminService } from './admin.service';
import { DialogService } from './dialog.service';

describe('WhatsAppSesionService', () => {
  const estado = { status: 'READY', statusMessage: 'Conectado', isReady: true, qrCodeDataUrl: '' };
  let admin: any;
  let dialog: any;
  let servicio: WhatsAppSesionService;

  beforeEach(() => {
    vi.useFakeTimers();
    admin = {
      getWhatsAppStatus: vi.fn(() => of({ data: estado })),
      initWhatsApp: vi.fn(() => of({ data: estado })),
      logoutWhatsApp: vi.fn(() => of({ status: 'OK' }))
    };
    dialog = { confirmar: vi.fn(async () => true) };
    TestBed.configureTestingModule({
      providers: [
        { provide: AdminService, useValue: admin },
        { provide: DialogService, useValue: dialog }
      ]
    });
    servicio = TestBed.inject(WhatsAppSesionService);
  });

  afterEach(() => vi.useRealTimers());

  it('abre el panel, consulta el estado y lo sondea mientras está visible', () => {
    servicio.abrir();
    expect(servicio.visible()).toBe(true);
    expect(servicio.estado()).toEqual(estado);
    vi.advanceTimersByTime(3000);
    expect(admin.getWhatsAppStatus).toHaveBeenCalledTimes(3);

    servicio.cerrar();
    vi.advanceTimersByTime(3000);
    expect(servicio.visible()).toBe(false);
    expect(admin.getWhatsAppStatus).toHaveBeenCalledTimes(3);
  });

  it('cierra la sesión solo tras confirmar', async () => {
    dialog.confirmar.mockResolvedValueOnce(false);
    await servicio.cerrarSesion();
    expect(admin.logoutWhatsApp).not.toHaveBeenCalled();

    await servicio.cerrarSesion();
    expect(admin.logoutWhatsApp).toHaveBeenCalledTimes(1);
  });
});
