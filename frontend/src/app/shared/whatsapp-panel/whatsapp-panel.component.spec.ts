import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WhatsAppPanelComponent } from './whatsapp-panel.component';
import { WhatsAppSesionService } from '../../core/services/whatsapp-sesion.service';
import { signal } from '@angular/core';
import { GrupoWhatsApp } from '../../core/models/api-payloads';

describe('WhatsAppPanelComponent (Filtro de Grupos)', () => {
  let fixture: ComponentFixture<WhatsAppPanelComponent>;
  let component: WhatsAppPanelComponent;
  let sesionMock: any;

  const gruposMock: GrupoWhatsApp[] = [
    { id: '120363000000000001@g.us', nombre: 'Usuarios La Jones', participantes: 120 },
    { id: '120363000000000002@g.us', nombre: 'Directiva Junta General', participantes: 8 },
    { id: '120363000000000003@g.us', nombre: 'Riego Sector Alto', participantes: 45 },
    { id: '120363000000000004@g.us', nombre: 'Familia Perez', participantes: 15 }
  ];

  beforeEach(() => {
    sesionMock = {
      visible: signal(true),
      estado: signal({ estado: 'CONECTADO', conectado: true, grupo: null }),
      grupos: signal(gruposMock),
      cargandoGrupos: signal(false),
      guardandoGrupo: signal(false),
      cargarGrupos: vi.fn(),
      guardarGrupo: vi.fn(),
      cerrar: vi.fn()
    };

    TestBed.configureTestingModule({
      imports: [WhatsAppPanelComponent],
      providers: [
        { provide: WhatsAppSesionService, useValue: sesionMock }
      ]
    });

    fixture = TestBed.createComponent(WhatsAppPanelComponent);
    component = fixture.componentInstance;
  });

  it('lista todos los grupos disponibles cuando el filtro esta vacio', () => {
    expect(component.gruposFiltrados().length).toBe(4);
  });

  it('filtra los grupos por nombre en tiempo real sin importar mayusculas o minusculas', () => {
    component.busquedaGrupo.set('riego');
    expect(component.gruposFiltrados().length).toBe(1);
    expect(component.gruposFiltrados()[0].nombre).toBe('Riego Sector Alto');

    component.busquedaGrupo.set('JUNTA');
    expect(component.gruposFiltrados().length).toBe(1);
    expect(component.gruposFiltrados()[0].nombre).toBe('Directiva Junta General');
  });

  it('retorna lista vacia si ningun grupo coincide con la busqueda', () => {
    component.busquedaGrupo.set('Grupo Inexistente XYZ');
    expect(component.gruposFiltrados().length).toBe(0);
  });

  it('mantiene visible el grupo seleccionado aunque no coincida con el filtro actual', () => {
    component.seleccion.set('120363000000000002@g.us'); // Directiva Junta General
    component.busquedaGrupo.set('Riego'); // Filtro por Riego
    const filtrados = component.gruposFiltrados();

    expect(filtrados.some((g) => g.id === '120363000000000002@g.us')).toBe(true);
    expect(filtrados.some((g) => g.id === '120363000000000003@g.us')).toBe(true);
  });

  it('guarda el grupo seleccionado al invocar guardar()', () => {
    component.seleccion.set('120363000000000001@g.us');
    component.guardar();
    expect(sesionMock.guardarGrupo).toHaveBeenCalledWith('120363000000000001@g.us');
  });

  it('cierra la sesion al desmontarse (ngOnDestroy)', () => {
    component.ngOnDestroy();
    expect(sesionMock.cerrar).toHaveBeenCalled();
  });
});
