import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { ModalA11yDirective } from './modal-a11y.directive';

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
});
