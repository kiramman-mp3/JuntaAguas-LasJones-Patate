import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';
import { MingasAdminComponent } from './mingas-admin.component';
import { AdminService } from '../../../../core/services/admin.service';
import { ConsultaService } from '../../../../core/services/consulta.service';

const minga = {
  id: 1,
  tipo: 'MINGA' as const,
  titulo: 'Limpieza del canal',
  descripcion: 'Traer palas',
  fecha: '2020-01-01',
  hora_inicio: '08:00',
  lugar: 'Canal principal',
  estado: 'BORRADOR',
  genera_multa_ausencia: true,
  valor_multa: 10,
  asistentes: 0,
  totalComuneros: 2,
};

describe('Gestión de Mingas', () => {
  let component: MingasAdminComponent;
  let admin: any;
  let consulta: any;

  beforeEach(async () => {
    admin = {
      getEventos: vi.fn(() => of({ data: [minga] })),
      createEvento: vi.fn(() => of({ eventoId: 1 })),
      getPersonas: vi.fn(() =>
        of({
          data: [
            { id: 1, nombres: 'Ana', apellidos: 'Pérez', cedula: '1800000001' },
            { id: 2, nombres: 'Luis', apellidos: 'Mora', cedula: '1800000002' },
          ],
        }),
      ),
      getAsistencias: vi.fn(() =>
        of({ data: [{ persona_id: 1, estado: 'JUSTIFICADO', motivo_justificacion: 'Salud' }] }),
      ),
      getAsistenciasMinga: vi.fn(() => of({
        estado: 'BORRADOR', resumen: { total: 2, presentes: 0, ausentes: 0, justificados: 1, pendientes: 1 },
        data: [
          { persona_id: 1, nombre: 'Pérez Ana', cedula: '1800000001', estado: 'JUSTIFICADO', motivo_justificacion: 'Salud' },
          { persona_id: 2, nombre: 'Mora Luis', cedula: '1800000002', estado: 'PENDIENTE', motivo_justificacion: '' },
        ],
      })),
      registrarAsistencias: vi.fn(() => of({ status: 'OK' })),
      registrarAsistenciasMinga: vi.fn(() => of({ status: 'OK' })),
      cambiarEstadoMinga: vi.fn((_id: number, estado: string) => of({ estado, message: 'Actualizado' })),
      finalizarMinga: vi.fn(() => of({ estado: 'REALIZADO', message: 'Finalizada' })),
      notificarMingaWhatsApp: vi.fn(() => of({ message: 'Enviado' })),
    };
    consulta = {
      subirDocumentoEvento: vi.fn(),
      descargarListaAsistencia: vi.fn(),
      urlDocumento: vi.fn(),
    };
    await TestBed.configureTestingModule({
      imports: [MingasAdminComponent],
      providers: [
        { provide: AdminService, useValue: admin },
        { provide: ConsultaService, useValue: consulta },
      ],
    }).compileComponents();
    component = TestBed.createComponent(MingasAdminComponent).componentInstance;
  });

  it('carga solo Mingas y permite consultar fechas anteriores', () => {
    component.cargar();
    expect(admin.getEventos).toHaveBeenCalledWith('MINGA');
    expect(component.mingasFiltradas).toHaveLength(1);
    component.periodo = 'PROXIMAS';
    expect(component.mingasFiltradas).toHaveLength(0);
    component.periodo = 'ANTERIORES';
    expect(component.mingasFiltradas).toHaveLength(1);
  });

  it('crea una Minga sin campos de Asamblea y sin enviar mensajes automáticamente', () => {
    component.formulario = {
      titulo: ' Limpieza ',
      descripcion: ' Canal ',
      fecha: '2026-10-03',
      hora_inicio: '08:00',
      lugar: ' Entrada ',
      genera_multa_ausencia: false,
      valor_multa: 10,
    };
    component.guardarNueva();
    const payload = admin.createEvento.mock.calls[0][0];
    expect(payload).toMatchObject({
      tipo: 'MINGA',
      titulo: 'Limpieza',
      lugar: 'Entrada',
      valor_multa: 0,
    });
    expect(payload).not.toHaveProperty('subtipo_asamblea');
    expect(payload).not.toHaveProperty('puntos_orden_dia');
    expect(admin.notificarMingaWhatsApp).not.toHaveBeenCalled();
  });

  it('conserva justificaciones y deja sin marcar como pendiente', () => {
    component.abrirAsistencia(minga);
    component.guardarAsistencia();
    expect(admin.registrarAsistenciasMinga).toHaveBeenCalledWith(1, [
      { persona_id: 1, estado: 'JUSTIFICADO', motivo_justificacion: 'Salud' },
      { persona_id: 2, estado: 'PENDIENTE', motivo_justificacion: null },
    ]);
  });

  it('permite corregir una justificación vacía y volver a guardar', () => {
    component.abrirAsistencia(minga);
    component.asistencias[0].motivo_justificacion = '';
    component.guardarAsistencia();
    expect(admin.registrarAsistenciasMinga).not.toHaveBeenCalled();
    component.asistencias[0].motivo_justificacion = 'Trabajo';
    component.guardarAsistencia();
    expect(admin.registrarAsistenciasMinga).toHaveBeenCalledOnce();
  });

  it('no guarda una asistencia vacía cuando falla la carga de registros previos', () => {
    admin.getAsistenciasMinga.mockReturnValue(throwError(() => new Error('Sin conexión')));
    component.abrirAsistencia(minga);
    component.guardarAsistencia();
    expect(component.errorAsistencia).toBeTruthy();
    expect(admin.registrarAsistenciasMinga).not.toHaveBeenCalled();
  });

  it('evita el doble envío mientras la convocatoria está en curso', () => {
    const respuesta = new Subject();
    admin.notificarMingaWhatsApp.mockReturnValue(respuesta);
    const confirmacion = vi.spyOn(window, 'confirm').mockReturnValue(true);
    component.enviarConvocatoria(minga);
    component.enviarConvocatoria(minga);
    expect(admin.notificarMingaWhatsApp).toHaveBeenCalledOnce();
    respuesta.next({ message: 'Enviado' });
    respuesta.complete();
    expect(component.enviandoId).toBeNull();
    confirmacion.mockRestore();
  });

  it('rechaza un archivo incompatible sin subirlo', () => {
    component.subirLista(minga, {
      files: [new File(['texto'], 'lista.txt', { type: 'text/plain' })],
      value: 'lista.txt',
    } as unknown as HTMLInputElement);
    expect(component.error).toContain('PDF');
    expect(consulta.subirDocumentoEvento).not.toHaveBeenCalled();
  });

  it('marca convocada después de un envío exitoso', () => {
    admin.notificarMingaWhatsApp.mockReturnValue(of({ enviados: 2, message: 'Enviado' }));
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(true);
    component.enviarConvocatoria({ ...minga });
    expect(admin.cambiarEstadoMinga).toHaveBeenCalledWith(1, 'CONVOCADO');
    confirmar.mockRestore();
  });

  it('impide modificar una asistencia finalizada desde la interfaz', () => {
    admin.getAsistenciasMinga.mockReturnValue(of({ estado: 'REALIZADO', data: [] }));
    component.abrirAsistencia({ ...minga, estado: 'REALIZADO' });
    component.guardarAsistencia();
    expect(component.asistenciaCerrada).toBe(true);
    expect(admin.registrarAsistenciasMinga).not.toHaveBeenCalled();
  });

  it('no finaliza cuando hay asistentes pendientes en el backend', () => {
    component.finalizarMinga({ ...minga });
    expect(admin.finalizarMinga).not.toHaveBeenCalled();
    expect(component.error).toContain('Pendientes: 1');
    expect(component.actualizandoId).toBeNull();
  });

  it('confirma el resumen guardado antes de finalizar', () => {
    admin.getAsistenciasMinga.mockReturnValue(of({ resumen: { total: 2, presentes: 1, ausentes: 1, justificados: 0, pendientes: 0 } }));
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(true);
    component.finalizarMinga({ ...minga });
    expect(admin.finalizarMinga).toHaveBeenCalledWith(1);
    expect(confirmar.mock.calls[0][0]).toContain('1 ausentes');
    confirmar.mockRestore();
  });

  it('muestra acciones propias de Minga sin subtipo ni actas', () => {
    const fixture = TestBed.createComponent(MingasAdminComponent);
    fixture.detectChanges();
    const texto = fixture.nativeElement.textContent;
    expect(texto).toContain('Convocar por WhatsApp');
    expect(texto).toContain('Lista de asistencia');
    expect(texto).not.toContain('ORDINARIA');
    expect(texto).not.toContain('Acta Resolutiva');
  });
});
