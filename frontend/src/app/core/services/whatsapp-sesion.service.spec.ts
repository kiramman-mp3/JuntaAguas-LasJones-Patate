import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WhatsAppSesionService } from './whatsapp-sesion.service';
import { AdminService } from './admin.service';
import { DialogService } from './dialog.service';
import { NotificationService } from './notification.service';

const GRUPO = { id: '120363000000000001@g.us', nombre: 'Comuneros La Jones' };
const conectado = { estado: 'CONECTADO', conectado: true, mensaje: 'Conectado', qr: null, grupo: GRUPO };
const iniciando = { estado: 'INICIANDO', conectado: false, mensaje: 'Iniciando', qr: null, grupo: null };
const errorHttp = (codigo: string, message: string) => throwError(() => ({ status: 409, error: { status: 'ERROR', message, codigo } }));

describe('WhatsAppSesionService', () => {
  let admin: any;
  let dialog: any;
  let notify: any;
  let servicio: WhatsAppSesionService;

  beforeEach(() => {
    vi.useFakeTimers();
    admin = {
      getWhatsAppEstado: vi.fn(() => of({ data: conectado })),
      iniciarWhatsApp: vi.fn(() => of({ data: iniciando })),
      cerrarSesionWhatsApp: vi.fn(() => of({ data: { ...conectado, estado: 'DESCONECTADO', conectado: false } })),
      getGruposWhatsApp: vi.fn(() => of({ data: [GRUPO] })),
      guardarGrupoWhatsApp: vi.fn(() => of({ data: GRUPO, message: 'Guardado' })),
      enviarConvocatoriaWhatsApp: vi.fn(() => of({ data: { grupo: GRUPO, estado: 'CONVOCADO', reenvio: false }, message: 'Publicada' }))
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
    servicio = TestBed.inject(WhatsAppSesionService);
  });

  afterEach(() => vi.useRealTimers());

  it('al abrir consulta el estado y carga los grupos si está conectado, sin iniciar WhatsApp', () => {
    servicio.abrir();
    expect(servicio.visible()).toBe(true);
    expect(servicio.estado()).toEqual(conectado);
    expect(servicio.grupos()).toEqual([GRUPO]);
    expect(admin.iniciarWhatsApp).not.toHaveBeenCalled();
  });

  it('solo sondea mientras la conexión está en curso y deja de hacerlo al cerrar', () => {
    admin.getWhatsAppEstado.mockReturnValue(of({ data: conectado }));
    servicio.abrir();
    vi.advanceTimersByTime(6000);
    expect(admin.getWhatsAppEstado).toHaveBeenCalledTimes(1);

    servicio.conectar();
    expect(servicio.estado()?.estado).toBe('INICIANDO');
    vi.advanceTimersByTime(4000);
    expect(admin.getWhatsAppEstado).toHaveBeenCalledTimes(2);

    servicio.cerrar();
    vi.advanceTimersByTime(6000);
    expect(admin.getWhatsAppEstado).toHaveBeenCalledTimes(2);
  });

  it('desvincula el teléfono solo tras confirmar', async () => {
    dialog.confirmar.mockResolvedValueOnce(false);
    await servicio.cerrarSesion();
    expect(admin.cerrarSesionWhatsApp).not.toHaveBeenCalled();

    await servicio.cerrarSesion();
    expect(admin.cerrarSesionWhatsApp).toHaveBeenCalledTimes(1);
    expect(servicio.estado()?.estado).toBe('DESCONECTADO');
  });

  it('guarda el grupo elegido y lo refleja en el estado', () => {
    servicio.abrir();
    admin.guardarGrupoWhatsApp.mockReturnValue(of({ data: { id: 'otro@g.us', nombre: 'Directiva' }, message: 'Guardado' }));
    servicio.guardarGrupo('otro@g.us');
    expect(admin.guardarGrupoWhatsApp).toHaveBeenCalledWith('otro@g.us');
    expect(servicio.estado()?.grupo).toEqual({ id: 'otro@g.us', nombre: 'Directiva' });
  });

  it('publica la convocatoria tras confirmar y devuelve el nuevo estado', async () => {
    const resultado = await servicio.convocar({ id: 7, titulo: 'Minga' });
    expect(admin.enviarConvocatoriaWhatsApp).toHaveBeenCalledWith(7, false);
    expect(resultado?.estado).toBe('CONVOCADO');
    expect(notify.success).toHaveBeenCalledWith('Publicada');
    expect(servicio.enviandoEventoId()).toBeNull();
  });

  it('no envía si el administrador cancela', async () => {
    dialog.confirmar.mockResolvedValueOnce(false);
    expect(await servicio.convocar({ id: 7, titulo: 'Minga' })).toBeNull();
    expect(admin.enviarConvocatoriaWhatsApp).not.toHaveBeenCalled();
  });

  it('evita el doble envío mientras una convocatoria está en curso', async () => {
    const respuesta = new Subject<any>();
    admin.enviarConvocatoriaWhatsApp.mockReturnValue(respuesta);
    const primera = servicio.convocar({ id: 7, titulo: 'Minga' });
    expect(await servicio.convocar({ id: 7, titulo: 'Minga' })).toBeNull();
    await vi.waitFor(() => expect(admin.enviarConvocatoriaWhatsApp).toHaveBeenCalledOnce());
    respuesta.next({ data: { grupo: GRUPO, estado: 'CONVOCADO', reenvio: false } });
    respuesta.complete();
    await primera;
    expect(admin.enviarConvocatoriaWhatsApp).toHaveBeenCalledOnce();
  });

  it('pregunta antes de reenviar una convocatoria ya publicada', async () => {
    admin.enviarConvocatoriaWhatsApp
      .mockReturnValueOnce(errorHttp('CONVOCATORIA_YA_ENVIADA', 'Ya se publicó.'))
      .mockReturnValueOnce(of({ data: { grupo: GRUPO, estado: 'CONVOCADO', reenvio: true }, message: 'Publicada' }));
    const resultado = await servicio.convocar({ id: 7, titulo: 'Minga' });
    expect(dialog.confirmar).toHaveBeenCalledTimes(2);
    expect(dialog.confirmar.mock.calls[1][0].mensaje).toContain('Ya se publicó.');
    expect(admin.enviarConvocatoriaWhatsApp).toHaveBeenLastCalledWith(7, true);
    expect(resultado?.reenvio).toBe(true);
  });

  it('sin grupo configurado abre el panel para elegirlo', async () => {
    admin.enviarConvocatoriaWhatsApp.mockReturnValue(errorHttp('GRUPO_NO_CONFIGURADO', 'Elija el grupo.'));
    expect(await servicio.convocar({ id: 7, titulo: 'Minga' })).toBeNull();
    expect(notify.warning).toHaveBeenCalledWith('Elija el grupo.');
    expect(servicio.visible()).toBe(true);
  });

  it('muestra el error del servidor si no se pudo publicar', async () => {
    admin.enviarConvocatoriaWhatsApp.mockReturnValue(throwError(() => ({ status: 503, error: { message: 'Servicio caído' } })));
    expect(await servicio.convocar({ id: 7, titulo: 'Minga' })).toBeNull();
    expect(notify.error).toHaveBeenCalledWith('Servicio caído');
  });
});
