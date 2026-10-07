import { Component, ElementRef, HostListener, inject, input, signal } from '@angular/core';

let siguienteId = 0;

/**
 * Menú contextual "⋯" para acciones poco frecuentes. Se abre desde su botón (el panel
 * crece desde ese punto), se cierra al elegir una opción, con Escape o al tocar fuera.
 * Las opciones se proyectan como `<button class="menu__item">`.
 */
@Component({
  selector: 'app-menu',
  standalone: true,
  template: `
    <button type="button" class="icon-btn menu__trigger" [attr.aria-expanded]="abierto()" [attr.aria-controls]="panelId"
      aria-haspopup="menu" [attr.aria-label]="etiqueta()" [title]="etiqueta()" (click)="alternar()">
      <i class="ri-more-2-fill" aria-hidden="true"></i>
    </button>
    @if (abierto()) {
      <div class="menu__panel" role="menu" [id]="panelId" animate.enter="menu__panel--enter">
        <ng-content />
      </div>
    }
  `,
  host: { class: 'menu' }
})
export class MenuComponent {
  private host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly etiqueta = input('Más acciones');
  readonly abierto = signal(false);
  readonly panelId = `menu-${++siguienteId}`;

  alternar(): void {
    this.abierto.update((v) => !v);
    if (this.abierto()) {
      setTimeout(() => this.host.nativeElement.querySelector<HTMLElement>('.menu__item:not(:disabled)')?.focus());
    }
  }

  cerrar(): void {
    this.abierto.set(false);
  }

  /** Elegir una opción cierra el menú (la acción de la opción ya se ejecutó). */
  @HostListener('click', ['$event'])
  alElegir(evento: MouseEvent): void {
    if ((evento.target as HTMLElement).closest('.menu__item')) this.cerrar();
  }

  @HostListener('document:mousedown', ['$event'])
  alTocarFuera(evento: MouseEvent): void {
    if (this.abierto() && !this.host.nativeElement.contains(evento.target as Node)) this.cerrar();
  }

  @HostListener('keydown.escape')
  alEscapar(): void {
    if (!this.abierto()) return;
    this.cerrar();
    this.host.nativeElement.querySelector<HTMLElement>('.menu__trigger')?.focus();
  }
}
