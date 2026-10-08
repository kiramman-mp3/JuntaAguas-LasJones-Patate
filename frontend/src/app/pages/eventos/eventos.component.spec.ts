import { of } from 'rxjs';
import { vi } from 'vitest';
import { EventosComponent } from './eventos.component';
import { TestBed } from '@angular/core/testing';
import { ConsultaService } from '../../core/services/consulta.service';
import { Router } from '@angular/router';
import { ChangeDetectorRef } from '@angular/core';

describe('Eventos públicos', () => {
  afterEach(() => vi.useRealTimers());

  it('a las 21:00 de Ecuador (día siguiente en UTC) un evento de hoy sigue apareciendo como próximo', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-06T02:00:00Z')); // 5 de octubre, 21:00 en Ecuador
    const eventos = [
      { id: 1, tipo: 'ASAMBLEA', fecha: '2026-10-05', estado: 'CONVOCADO' },
      { id: 2, tipo: 'MINGA', fecha: '2026-10-04', estado: 'PROGRAMADO' },
      { id: 3, tipo: 'MINGA', fecha: '2026-10-11', estado: 'PROGRAMADO' },
      { id: 4, tipo: 'ASAMBLEA', fecha: '2026-10-20', estado: 'CANCELADO' }
    ];
    const consulta = { getEventosPublicos: () => of({ status: 'OK', data: eventos }) };
    TestBed.configureTestingModule({
      providers: [
        { provide: ConsultaService, useValue: consulta },
        { provide: Router, useValue: {} },
        { provide: ChangeDetectorRef, useValue: { detectChanges: vi.fn() } }
      ]
    });
    const component = TestBed.runInInjectionContext(() => new EventosComponent());
    component.ngOnInit();
    expect(component.asambleasFuturas.map((e) => e.id)).toEqual([1]);
    expect(component.mingasFuturas.map((e) => e.id)).toEqual([3]);
  });
});
