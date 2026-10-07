import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { ModalA11yDirective } from './modal-a11y.directive';

/** Como <app-modal>: el fondo vive dentro de la plantilla de otro componente. */
@Component({
  selector: 'app-modal-hijo',
  standalone: true,
  imports: [ModalA11yDirective],
  template: `<div appModalA11y class="modal-backdrop" id="hijo"><button type="button" class="btn-close">x</button></div>`
})
class ModalHijoComponent {}

@Component({
  standalone: true,
  imports: [ModalHijoComponent],
  template: `@if (abierto()) { <app-modal-hijo /> }`
})
class PadreComponent {
  readonly abierto = signal(true);
}

@Component({
  standalone: true,
  imports: [ModalA11yDirective],
  template: `
    <div class="contenedor-animado" style="transform: translateX(0)">
      @if (primero()) {
        <div appModalA11y class="modal-backdrop" id="primero"><button type="button" class="btn-close">x</button></div>
      }
      @if (segundo()) {
        <div appModalA11y class="modal-backdrop" id="segundo"><button type="button">ok</button></div>
      }
    </div>
  `
})
class AnfitrionComponent {
  readonly primero = signal(false);
  readonly segundo = signal(false);
}

describe('ModalA11yDirective', () => {
  const crear = () => {
    const fixture = TestBed.createComponent(AnfitrionComponent);
    fixture.detectChanges();
    return fixture;
  };

  it('mueve el modal a <body> para que ningún ancestro lo deje debajo de otras capas', () => {
    const fixture = crear();
    fixture.componentInstance.primero.set(true);
    fixture.detectChanges();
    const modal = document.getElementById('primero')!;
    expect(modal.parentElement).toBe(document.body);
    expect(fixture.nativeElement.querySelector('#primero')).toBeNull();

    fixture.componentInstance.primero.set(false);
    fixture.detectChanges();
    expect(document.getElementById('primero')).toBeNull();
  });

  it('bloquea el scroll mientras quede algún modal abierto, también con modales anidados', () => {
    const fixture = crear();
    const html = document.documentElement;
    fixture.componentInstance.primero.set(true);
    fixture.detectChanges();
    fixture.componentInstance.segundo.set(true);
    fixture.detectChanges();
    expect(html.style.overflow).toBe('hidden');

    fixture.componentInstance.primero.set(false);
    fixture.detectChanges();
    expect(html.style.overflow).toBe('hidden');

    fixture.componentInstance.segundo.set(false);
    fixture.detectChanges();
    expect(html.style.overflow).toBe('');
  });

  it('retira el fondo al cerrar aunque esté dentro de otro componente (no queda tapando la página)', () => {
    vi.useFakeTimers();
    try {
      const fixture = TestBed.createComponent(PadreComponent);
      fixture.detectChanges();
      expect(document.getElementById('hijo')?.parentElement).toBe(document.body);

      fixture.componentInstance.abierto.set(false);
      fixture.detectChanges();
      vi.advanceTimersByTime(300);
      expect(document.getElementById('hijo')).toBeNull();
      expect(document.documentElement.style.overflow).toBe('');
    } finally {
      vi.useRealTimers();
    }
  });
});
