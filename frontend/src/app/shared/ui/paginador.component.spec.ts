import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { PaginadorComponent, paginasVisibles } from './paginador.component';

function crear(entradas: { pagina: number; porPagina: number; total: number }) {
  const fixture = TestBed.createComponent(PaginadorComponent);
  fixture.componentRef.setInput('pagina', entradas.pagina);
  fixture.componentRef.setInput('porPagina', entradas.porPagina);
  fixture.componentRef.setInput('total', entradas.total);
  fixture.componentRef.setInput('etiqueta', 'lotes');
  fixture.detectChanges();
  const paginas: number[] = [];
  const tamanos: number[] = [];
  fixture.componentInstance.paginaChange.subscribe((p) => paginas.push(p));
  fixture.componentInstance.porPaginaChange.subscribe((t) => tamanos.push(t));
  return { fixture, el: fixture.nativeElement as HTMLElement, paginas, tamanos };
}

describe('paginasVisibles', () => {
  it('muestra todas las páginas cuando son pocas', () => {
    expect(paginasVisibles(1, 1)).toEqual([1]);
    expect(paginasVisibles(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('resume con saltos y conserva la primera, la última y las vecinas', () => {
    expect(paginasVisibles(1, 12)).toEqual([1, 2, 3, 4, 5, null, 12]);
    expect(paginasVisibles(6, 12)).toEqual([1, null, 5, 6, 7, null, 12]);
    expect(paginasVisibles(12, 12)).toEqual([1, null, 8, 9, 10, 11, 12]);
  });
});

describe('PaginadorComponent', () => {
  it('resume el rango mostrado', () => {
    const { el } = crear({ pagina: 2, porPagina: 25, total: 60 });
    expect(el.textContent).toContain('Mostrando 26–50 de 60 lotes');
  });

  it('en la última página el rango termina en el total', () => {
    const { el } = crear({ pagina: 3, porPagina: 25, total: 60 });
    expect(el.textContent).toContain('51–60 de 60');
  });

  it('sin registros no muestra páginas', () => {
    const { el } = crear({ pagina: 1, porPagina: 25, total: 0 });
    expect(el.textContent).toContain('Sin lotes');
    expect(el.querySelector('nav')).toBeNull();
  });

  it('avisa el cambio de página y no sale de los límites', () => {
    const { fixture, el, paginas } = crear({ pagina: 1, porPagina: 10, total: 30 });
    const botones = Array.from(el.querySelectorAll<HTMLButtonElement>('nav button'));
    expect(botones[0].disabled).toBe(true);
    botones.find((b) => b.textContent?.trim() === '3')!.click();
    fixture.componentInstance.ir(0);
    fixture.componentInstance.ir(4);
    fixture.componentInstance.ir(1);
    expect(paginas).toEqual([3]);
  });

  it('marca la página actual para lectores de pantalla', () => {
    const { el } = crear({ pagina: 2, porPagina: 10, total: 30 });
    expect(el.querySelector('[aria-current="page"]')?.textContent?.trim()).toBe('2');
  });

  it('avisa el cambio de cantidad por página', () => {
    const { el, tamanos } = crear({ pagina: 1, porPagina: 25, total: 30 });
    const select = el.querySelector('select')!;
    select.value = '50';
    select.dispatchEvent(new Event('change'));
    expect(tamanos).toEqual([50]);
  });
});
