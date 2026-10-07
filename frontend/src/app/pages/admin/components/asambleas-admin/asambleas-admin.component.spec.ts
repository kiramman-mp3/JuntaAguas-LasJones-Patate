import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AsambleasAdminComponent, AsambleaItem } from './asambleas-admin.component';
import { AdminService } from '../../../../core/services/admin.service';
import { ConsultaService } from '../../../../core/services/consulta.service';
import { ActasService } from '../../../../core/services/actas.service';

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

describe('Módulo de Asambleas (AsambleasAdminComponent)', () => {
  let component: AsambleasAdminComponent;
  let adminMock: any;
  let consultaMock: any;
  let actasMock: any;

  beforeEach(async () => {
    adminMock = {
      getEventos: vi.fn(() => of({ data: [asambleaMock] })),
      createEvento: vi.fn(() => of({ status: 'OK', eventoId: 10 })),
      cambiarEstadoAsamblea: vi.fn((_id: number, estado: string) => of({ status: 'OK', estado })),
      finalizarAsamblea: vi.fn(() => of({ status: 'OK', multasGeneradas: 3 })),
      guardarPuntosAsamblea: vi.fn((_id: number, puntos: any[]) => of({ status: 'OK', data: puntos })),
      cambiarEstadoActaPunto: vi.fn(() => of({ status: 'OK' })),
      subirDocumentoFirmado: vi.fn(() => of({ status: 'OK', url: '/uploads/documentos/doc.pdf' })),
      getPersonas: vi.fn(() => of({ data: [{ id: 1, cedula: '1800000001', nombres: 'Carlos', apellidos: 'Moreta' }] })),
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

    actasMock = {
      generarConvocatoriaPDF: vi.fn(),
      generarActaPDF: vi.fn(),
      generarActaPuntoPDF: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [AsambleasAdminComponent],
      providers: [
        { provide: AdminService, useValue: adminMock },
        { provide: ConsultaService, useValue: consultaMock },
        { provide: ActasService, useValue: actasMock }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(AsambleasAdminComponent);
    component = fixture.componentInstance;
  });

  it('carga la lista de asambleas y filtra por subtipo y período', () => {
    component.cargar();
    expect(adminMock.getEventos).toHaveBeenCalledWith('ASAMBLEA');
    expect(component.asambleasFiltradas.length).toBe(1);

    component.subtipoFiltro = 'EXTRAORDINARIA';
    expect(component.asambleasFiltradas.length).toBe(0);

    component.subtipoFiltro = 'ORDINARIA';
    expect(component.asambleasFiltradas.length).toBe(1);
  });

  it('permite registrar una nueva asamblea con puntos de orden del día dinámicos', () => {
    component.formulario = {
      subtipo_asamblea: 'ORDINARIA',
      titulo: 'Asamblea Nueva',
      descripcion: 'Detalle',
      fecha: '2026-11-01',
      hora_inicio: '19:00',
      hora_fin: '21:00',
      lugar: 'Sede Central',
      genera_multa_ausencia: true,
      valor_multa: 15,
      puntos_orden_dia: ['Punto 1', 'Punto 2']
    };
    component.guardarNueva();
    expect(adminMock.createEvento).toHaveBeenCalled();
    const payload = adminMock.createEvento.mock.calls[0][0];
    expect(payload.tipo).toBe('ASAMBLEA');
    expect(payload.subtipo_asamblea).toBe('ORDINARIA');
    expect(payload.puntos_orden_dia).toEqual(['Punto 1', 'Punto 2']);
  });

  it('soporta la transición de estados clara (C10, F05)', () => {
    const a = { ...asambleaMock };
    component.cambiarEstado(a, 'PROGRAMADO');
    expect(adminMock.cambiarEstadoAsamblea).toHaveBeenCalledWith(10, 'PROGRAMADO');
    expect(a.estado).toBe('PROGRAMADO');

    component.cambiarEstado(a, 'CONVOCADO');
    expect(adminMock.cambiarEstadoAsamblea).toHaveBeenCalledWith(10, 'CONVOCADO');
    expect(a.estado).toBe('CONVOCADO');
  });

  it('al reabrir la asistencia muestra los estados ya guardados en el servidor', () => {
    component.abrirAsistencia(asambleaMock);
    expect(adminMock.getAsistencias).toHaveBeenCalledWith(10);
    expect(component.personasAsistencia.map((p: any) => p.estado)).toEqual(['PRESENTE', 'JUSTIFICADO']);
    expect(component.personasAsistencia[1].motivo_justificacion).toBe('Enfermedad');
    expect(adminMock.getPersonas).not.toHaveBeenCalled();
  });

  it('soporta registrar múltiples actas por asamblea y agregar temas nuevos (F07)', () => {
    component.abrirModalActas(asambleaMock);
    expect(consultaMock.getEventoDetalle).toHaveBeenCalledWith(10);
    expect(component.puntosAsamblea.length).toBe(2);

    // Añadir tema nuevo durante la sesión
    component.nuevoTema = {
      punto_tratar: 'Reparación compuerta lateral',
      tratado: 'Se revisa daño por lluvia',
      resolucion: 'Aprobar partida de $150',
      responsables: 'Comisión técnica'
    };
    component.agregarTemaNuevo();
    expect(component.puntosAsamblea.length).toBe(3);
    expect(component.puntosAsamblea[2].punto_tratar).toContain('Reparación compuerta lateral');

    // Guardar todas las actas
    component.guardarTodosLosPuntos();
    expect(adminMock.guardarPuntosAsamblea).toHaveBeenCalledWith(10, component.puntosAsamblea);
  });

  it('permite generar el PDF individual de un acta por punto tratado (F07)', () => {
    component.asambleaSeleccionada = asambleaMock;
    const punto = { orden: 2, punto_tratar: 'Presupuesto 2026', tratado: 'Debate', resolucion: 'Aprobado' };
    component.descargarActaPorPunto(punto);
    expect(actasMock.generarActaPuntoPDF).toHaveBeenCalledWith(asambleaMock, punto);
  });

  it('permite generar la convocatoria en PDF oficial', () => {
    component.descargarConvocatoriaPdf(asambleaMock);
    expect(actasMock.generarConvocatoriaPDF).toHaveBeenCalledWith(asambleaMock);
  });
});
