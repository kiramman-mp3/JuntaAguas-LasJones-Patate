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

  it('presenta la directiva con el presidente y el secretario de la Junta', () => {
    const directiva = INFORMACION_JUNTA.directiva;
    expect(directiva.map((m) => m.cargo)).toEqual([
      'Presidente',
      'Vicepresidente',
      'Secretario',
      'Tesorera',
    ]);
    expect(directiva[0].nombre).toBe('Ramiro Cepeda Caicedo');
    expect(directiva[2].nombre).toBe('John Mora Pérez');
    directiva.forEach((m) => expect(m.nombre.trim()).not.toBe(''));
  });

  it('no publica números de cédula de la directiva', () => {
    expect(JSON.stringify(INFORMACION_JUNTA)).not.toMatch(/[0-9]{10}/);
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

  it('muestra quiénes somos, los órganos de dirección y la misión con las dos fotos', () => {
    TestBed.configureTestingModule({
      providers: [{ provide: HttpClient, useValue: { get: () => of({ status: 'OK', data: [] }) } }],
    });
    const fixture = TestBed.createComponent(InformacionComponent);
    fixture.detectChanges();
    const pagina = fixture.nativeElement as HTMLElement;
    const titulos = Array.from(pagina.querySelectorAll('h2')).map((h) => h.textContent?.trim());
    expect(titulos).toEqual(
      expect.arrayContaining(['Quiénes somos', 'Órganos de Dirección', 'Nuestra misión']),
    );
    expect(pagina.textContent).toContain('Lic. Ramiro Cepeda Caicedo');
    expect(pagina.textContent).toContain('Eco. John Mora Pérez');
    expect(pagina.textContent).toContain('3 vocales principales y 3 vocales suplentes');
    expect(pagina.querySelectorAll('img').length).toBe(2);
  });

  it('si la API falla, la página sigue mostrándose sin sectores', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const component = crear({ get: () => throwError(() => new Error('sin conexión')) });
    component.ngOnInit();
    expect(component.sectores).toEqual([]);
  });
});
