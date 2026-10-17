import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { ChangeDetectorRef } from '@angular/core';
import { InformacionComponent } from './informacion.component';
import { INFORMACION_JUNTA } from './informacion-junta.data';

function crear(http: { get: () => unknown }) {
  TestBed.configureTestingModule({
    providers: [
      { provide: HttpClient, useValue: http },
      { provide: ChangeDetectorRef, useValue: { detectChanges: vi.fn() } },
    ],
  });
  return TestBed.runInInjectionContext(() => new InformacionComponent());
}

describe('Información de la Junta', () => {
  afterEach(() => vi.restoreAllMocks());

  it('incluye al director y al secretario de la directiva', () => {
    const cargos = INFORMACION_JUNTA.directiva.map((m) => m.cargo);
    expect(cargos).toEqual(['Director', 'Secretario']);
    INFORMACION_JUNTA.directiva.forEach((m) => expect(m.nombre.trim()).not.toBe(''));
  });

  it('muestra los sectores registrados en la API', () => {
    const sectores = [
      { id: 1, nombre: 'Patate Viejo', lotesCount: 10, superficieHa: 4 },
      { id: 2, nombre: 'La Merced', lotesCount: 7, superficieHa: 3 },
    ];
    const http = { get: vi.fn(() => of({ status: 'OK', data: sectores })) };
    const component = crear(http);
    component.ngOnInit();
    expect(http.get).toHaveBeenCalledWith(expect.stringMatching(/\/lotes\/sectores$/));
    expect(component.sectores.map((s) => s.nombre)).toEqual(['Patate Viejo', 'La Merced']);
  });

  it('si la API falla, la página sigue mostrándose sin sectores', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const component = crear({ get: () => throwError(() => new Error('sin conexión')) });
    component.ngOnInit();
    expect(component.sectores).toEqual([]);
  });
});
