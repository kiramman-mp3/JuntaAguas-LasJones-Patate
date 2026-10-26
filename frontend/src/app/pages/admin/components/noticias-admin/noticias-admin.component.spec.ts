import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../../../../environments/environment';
import { NotificationService } from '../../../../core/services/notification.service';
import { NoticiasAdminComponent } from './noticias-admin.component';

function crear() {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  const http = TestBed.inject(HttpTestingController);
  const notify = TestBed.inject(NotificationService);
  const avisos: string[] = [];
  vi.spyOn(notify, 'warning').mockImplementation((m: string) => void avisos.push(m));
  const fixture = TestBed.createComponent(NoticiasAdminComponent);
  fixture.detectChanges();
  http
    .expectOne((r) => r.url === `${environment.apiUrl}/noticias`)
    .flush({
      status: 'OK',
      data: [],
      total: 0,
      pagina: 1,
      limite: 10,
    });
  return { componente: fixture.componentInstance, http, avisos };
}

describe('Administración de noticias', () => {
  afterEach(() => vi.restoreAllMocks());

  it('las etiquetas se guardan en minúsculas, sin repetir y con un máximo', () => {
    const { componente, http } = crear();
    componente.abrirNueva();
    for (const texto of ['  Minga ', 'MINGA', 'riego, canal']) {
      componente.etiquetaNueva = texto;
      componente.agregarEtiqueta();
    }
    // "riego, canal" se toma como una sola etiqueta con espacio; la coma separa al pulsar la tecla.
    expect(componente.form.tags).toEqual(['minga', 'riego canal']);

    for (let i = 0; i < 10; i += 1) {
      componente.etiquetaNueva = `etiqueta${i}`;
      componente.agregarEtiqueta();
    }
    expect(componente.form.tags).toHaveLength(componente.limites.etiquetas);
    http.verify();
  });

  it('quitar una etiqueta la elimina del formulario', () => {
    const { componente, http } = crear();
    componente.abrirNueva();
    componente.form.tags = ['a1', 'b2'];
    componente.quitarEtiqueta('a1');
    expect(componente.form.tags).toEqual(['b2']);
    http.verify();
  });

  it('no envía una noticia incompleta ni sin imagen', () => {
    const { componente, http, avisos } = crear();
    componente.abrirNueva();

    componente.guardar();
    expect(avisos.at(-1)).toMatch(/título/i);

    componente.form = {
      titulo: 'Título válido',
      descripcion_corta: 'Descripción corta válida',
      descripcion_larga: 'Descripción larga suficientemente extensa',
      tags: ['minga'],
    };
    componente.guardar();
    expect(avisos.at(-1)).toMatch(/imagen/i);
    http.expectNone(`${environment.apiUrl}/noticias`);
    http.verify();
  });

  it('rechaza archivos que no son JPG o PNG', () => {
    const { componente, http } = crear();
    componente.abrirNueva();
    const entrada = document.createElement('input');
    Object.defineProperty(entrada, 'files', {
      value: [new File(['%PDF'], 'doc.pdf', { type: 'application/pdf' })],
    });
    componente.elegirImagen(entrada);
    expect(componente.imagen).toBeNull();
    expect(componente.errorImagen()).toMatch(/JPG o PNG/);
    http.verify();
  });
});
