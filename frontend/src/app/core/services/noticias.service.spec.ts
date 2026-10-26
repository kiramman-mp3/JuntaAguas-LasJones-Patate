import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { NoticiasService } from './noticias.service';
import { environment } from '../../../environments/environment';

describe('NoticiasService', () => {
  let servicio: NoticiasService;
  let http: HttpTestingController;
  const url = `${environment.apiUrl}/noticias`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    servicio = TestBed.inject(NoticiasService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('envía solo los filtros que tienen valor', () => {
    servicio
      .listar({ q: 'canal', tag: '', desde: '2026-01-01', pagina: 2, limite: 12 })
      .subscribe();
    const peticion = http.expectOne((r) => r.url === url);
    expect(peticion.request.params.get('q')).toBe('canal');
    expect(peticion.request.params.get('desde')).toBe('2026-01-01');
    expect(peticion.request.params.get('pagina')).toBe('2');
    expect(peticion.request.params.get('limite')).toBe('12');
    expect(peticion.request.params.has('tag')).toBe(false);
    expect(peticion.request.params.has('hasta')).toBe(false);
    peticion.flush({ status: 'OK', data: [], total: 0, pagina: 2, limite: 12 });
  });

  it('desenvuelve las etiquetas y el detalle de la respuesta', () => {
    let etiquetas: unknown;
    let noticia: unknown;
    servicio.etiquetas().subscribe((e) => (etiquetas = e));
    servicio.obtener(7).subscribe((n) => (noticia = n));
    http
      .expectOne(`${url}/etiquetas`)
      .flush({ status: 'OK', data: [{ etiqueta: 'minga', cantidad: 3 }] });
    http.expectOne(`${url}/7`).flush({ status: 'OK', data: { id: 7, titulo: 'Hola' } });
    expect(etiquetas).toEqual([{ etiqueta: 'minga', cantidad: 3 }]);
    expect(noticia).toEqual({ id: 7, titulo: 'Hola' });
  });

  it('al crear envía los campos, las etiquetas en JSON y la imagen como "archivo"', () => {
    const imagen = new File(['x'], 'foto.png', { type: 'image/png' });
    servicio
      .crear(
        {
          titulo: 'Título',
          descripcion_corta: 'Corta',
          descripcion_larga: 'Larga',
          tags: ['a', 'b'],
        },
        imagen,
      )
      .subscribe();
    const peticion = http.expectOne(url);
    const cuerpo = peticion.request.body as FormData;
    expect(peticion.request.method).toBe('POST');
    expect(cuerpo.get('titulo')).toBe('Título');
    expect(cuerpo.get('tags')).toBe('["a","b"]');
    expect((cuerpo.get('archivo') as File).name).toBe('foto.png');
    peticion.flush({ noticiaId: 1 });
  });

  it('al editar sin imagen nueva no envía "archivo" para conservar la actual', () => {
    servicio
      .actualizar(
        5,
        { titulo: 'T', descripcion_corta: 'C', descripcion_larga: 'L', tags: ['x'] },
        null,
      )
      .subscribe();
    const peticion = http.expectOne(`${url}/5`);
    expect(peticion.request.method).toBe('PUT');
    expect((peticion.request.body as FormData).has('archivo')).toBe(false);
    peticion.flush({ message: 'ok' });
  });

  it('elimina por id y arma la URL absoluta de la imagen', () => {
    servicio.eliminar(9).subscribe();
    expect(http.expectOne(`${url}/9`).request.method).toBe('DELETE');
    expect(servicio.urlImagen('/uploads/documentos/a.png')).toBe(
      `${environment.serverUrl}/uploads/documentos/a.png`,
    );
    expect(servicio.urlImagen('https://cdn.ejemplo.com/a.png')).toBe(
      'https://cdn.ejemplo.com/a.png',
    );
  });
});
