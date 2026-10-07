import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AsambleasAdminComponent, AsambleaItem } from './asambleas-admin.component';
import { AsambleaFormComponent } from './asamblea-form/asamblea-form.component';
import { AsambleaAsistenciaComponent } from './asamblea-asistencia/asamblea-asistencia.component';
import { AsambleaActasComponent } from './asamblea-actas/asamblea-actas.component';
import { AdminService } from '../../../../core/services/admin.service';
import { ConsultaService } from '../../../../core/services/consulta.service';
import { ActasService } from '../../../../core/services/actas.service';
import { DialogService } from '../../../../core/services/dialog.service';

const asambleaMock: AsambleaItem = {
  id: 10,
  tipo: 'ASAMBLEA',
  subtipo_asamblea: 'ORDINARIA',
  titulo: 'Asamblea General Ordinaria Anual',
  descripcion: 'Revisión general',
  fecha: '2026-10-20',
  hora_inicio: '18:00',
  lugar: 'Casa Comunal Junta La Jones',
  estado: 'BORRADOR',
  genera_multa_ausencia: true,
  valor_multa: 10,
  asistentes: 5,
  totalComuneros: 20,
};

describe('Módulo de Asambleas', () => {
  let adminMock: any;
  let consultaMock: any;
  let actasMock: any;
  let dialogMock: any;

  beforeEach(async () => {
    adminMock = {
      getEventos: vi.fn(() => of({ data: [asambleaMock] })),
      createEvento: vi.fn(() => of({ status: 'OK', eventoId: 10 })),
      cambiarEstadoAsamblea: vi.fn((_id: number, estado: string) => of({ status: 'OK', estado })),
      finalizarAsamblea: vi.fn(() => of({ status: 'OK', multasGeneradas: 3 })),
      guardarPuntosAsamblea: vi.fn((_id: number, puntos: any[]) => of({ status: 'OK', data: puntos })),
      cambiarEstadoActaPunto: vi.fn(() => of({ status: 'OK' })),
      getPersonas: vi.fn(() => of({ data: [] })),
      registrarAsistencias: vi.fn(() => of({ status: 'OK' })),
      getAsistencias: vi.fn(() => of({
        status: 'OK',
        data: [
          { persona_id: 1, cedula: '1800000001', nombre: 'Moreta Carlos', estado: 'PRESENTE', motivo_justificacion: '' },
          { persona_id: 2, cedula: '1800000002', nombre: 'Quispe Rosa', estado: 'JUSTIFICADO', motivo_justificacion: 'Enfermedad' }
        ],
        resumen: { total: 2, presentes: 1, ausentes: 0, justificados: 1, pendientes: 0 }
      }))
    };

    consultaMock = {
      getEventoDetalle: vi.fn(() => of({
        status: 'OK',
        evento: asambleaMock,
        puntos: [
          { id: 1, orden: 1, punto_tratar: 'Constatación del cuórum', tratado: 'Verificado', resolucion: 'Instalada', estado_acta: 'APROBADA' },
          { id: 2, orden: 2, punto_tratar: 'Presupuesto 2026', tratado: 'Debate de cuotas', resolucion: 'Aprobado', estado_acta: 'APROBADA' }
        ]
      })),
      urlDocumento: vi.fn((url: string) => url)
    };

    actasMock = { generarConvocatoriaPDF: vi.fn(), generarActaPDF: vi.fn(), generarActaPuntoPDF: vi.fn() };
    dialogMock = { confirmar: vi.fn(async () => true), aviso: vi.fn(), solicitar: vi.fn() };

    await TestBed.configureTestingModule({
      providers: [
        { provide: AdminService, useValue: adminMock },
        { provide: ConsultaService, useValue: consultaMock },
        { provide: ActasService, useValue: actasMock },
        { provide: DialogService, useValue: dialogMock }
      ]
    }).compileComponents();
  });

  describe('Listado (AsambleasAdminComponent)', () => {
    let component: AsambleasAdminComponent;

    beforeEach(() => {
      component = TestBed.createComponent(AsambleasAdminComponent).componentInstance;
      component.cargar();
    });

    it('carga la lista de asambleas y filtra por subtipo', () => {
      expect(adminMock.getEventos).toHaveBeenCalledWith('ASAMBLEA');
      expect(component.filtradas().length).toBe(1);

      component.subtipoFiltro.set('EXTRAORDINARIA');
      expect(component.filtradas().length).toBe(0);
      expect(component.hayFiltros()).toBe(true);

      component.limpiarFiltros();
      expect(component.filtradas().length).toBe(1);
    });

    it('soporta la transición de estados clara (C10, F05)', async () => {
      await component.cambiarEstado(component.asambleas()[0], 'PROGRAMADO');
      expect(adminMock.cambiarEstadoAsamblea).toHaveBeenCalledWith(10, 'PROGRAMADO');
      expect(component.asambleas()[0].estado).toBe('PROGRAMADO');

      await component.cambiarEstado(component.asambleas()[0], 'CONVOCADO');
      expect(adminMock.cambiarEstadoAsamblea).toHaveBeenCalledWith(10, 'CONVOCADO');
      expect(component.asambleas()[0].estado).toBe('CONVOCADO');
    });

    it('pide confirmación antes de cancelar y no cambia nada si se rechaza', async () => {
      dialogMock.confirmar.mockResolvedValueOnce(false);
      await component.cambiarEstado(component.asambleas()[0], 'CANCELADO');
      expect(adminMock.cambiarEstadoAsamblea).not.toHaveBeenCalled();
    });

    it('no finaliza una asamblea que aún no fue convocada', async () => {
      await component.finalizarAsamblea(component.asambleas()[0]);
      expect(dialogMock.aviso).toHaveBeenCalled();
      expect(adminMock.finalizarAsamblea).not.toHaveBeenCalled();
    });

    it('permite generar la convocatoria en PDF oficial', () => {
      component.descargarConvocatoriaPdf(asambleaMock);
      expect(actasMock.generarConvocatoriaPDF).toHaveBeenCalledWith(asambleaMock);
    });
  });

  it('registra una nueva asamblea con puntos de orden del día dinámicos', () => {
    const component = TestBed.createComponent(AsambleaFormComponent).componentInstance;
    const creada = vi.fn();
    component.creada.subscribe(creada);
    component.formulario = {
      subtipo_asamblea: 'ORDINARIA',
      titulo: 'Asamblea Nueva',
      descripcion: 'Detalle',
      fecha: '2099-11-01',
      hora_inicio: '19:00',
      hora_fin: '21:00',
      lugar: 'Sede Central',
      genera_multa_ausencia: true,
      puntos_orden_dia: ['Punto 1', 'Punto 2']
    };
    component.guardar();
    const payload = adminMock.createEvento.mock.calls[0][0];
    expect(payload.tipo).toBe('ASAMBLEA');
    expect(payload.subtipo_asamblea).toBe('ORDINARIA');
    expect(payload.puntos_orden_dia).toEqual(['Punto 1', 'Punto 2']);
    expect(payload.genera_multa_ausencia).toBe(true);
    expect(payload).not.toHaveProperty('valor_multa');
    expect(creada).toHaveBeenCalled();
  });

  it('al reabrir la asistencia muestra los estados ya guardados en el servidor', () => {
    const fixture = TestBed.createComponent(AsambleaAsistenciaComponent);
    fixture.componentRef.setInput('asamblea', asambleaMock);
    fixture.componentInstance.ngOnInit();
    const component = fixture.componentInstance;

    expect(adminMock.getAsistencias).toHaveBeenCalledWith(10);
    expect(component.personas().map((p) => p.estado)).toEqual(['PRESENTE', 'JUSTIFICADO']);
    expect(component.personas()[1].motivo_justificacion).toBe('Enfermedad');
    expect(component.resumen()).toMatchObject({ total: 2, presentes: 1, justificados: 1 });
    expect(adminMock.getPersonas).not.toHaveBeenCalled();
  });

  it('exige el motivo de cada ausencia justificada antes de guardar', () => {
    const fixture = TestBed.createComponent(AsambleaAsistenciaComponent);
    fixture.componentRef.setInput('asamblea', asambleaMock);
    const component = fixture.componentInstance;
    component.ngOnInit();
    component.setEstado(component.personas()[0], 'JUSTIFICADO');
    component.guardar();
    expect(dialogMock.aviso).toHaveBeenCalled();
    expect(adminMock.registrarAsistencias).not.toHaveBeenCalled();
  });

  describe('Actas (AsambleaActasComponent)', () => {
    let component: AsambleaActasComponent;

    beforeEach(() => {
      const fixture = TestBed.createComponent(AsambleaActasComponent);
      fixture.componentRef.setInput('asamblea', asambleaMock);
      component = fixture.componentInstance;
      component.ngOnInit();
    });

    it('soporta registrar múltiples actas por asamblea y agregar temas nuevos (F07)', () => {
      expect(consultaMock.getEventoDetalle).toHaveBeenCalledWith(10);
      expect(component.puntos.length).toBe(2);

      component.nuevoTema = {
        punto_tratar: 'Reparación compuerta lateral',
        tratado: 'Se revisa daño por lluvia',
        resolucion: 'Aprobar partida de $150',
        responsables: 'Comisión técnica'
      };
      component.agregarTemaNuevo();
      expect(component.puntos.length).toBe(3);
      expect(component.puntos[2].punto_tratar).toContain('Reparación compuerta lateral');

      component.guardarTodos();
      expect(adminMock.guardarPuntosAsamblea).toHaveBeenCalledWith(10, component.puntos);
    });

    it('permite generar el PDF individual de un acta por punto tratado (F07)', () => {
      const punto = { orden: 2, punto_tratar: 'Presupuesto 2026', tratado: 'Debate', resolucion: 'Aprobado' };
      component.descargarActaPorPunto(punto);
      expect(actasMock.generarActaPuntoPDF).toHaveBeenCalledWith(asambleaMock, punto);
    });
  });
});
