import { Directive, ElementRef, HostListener, OnDestroy, OnInit, AfterViewInit } from '@angular/core';

/**
 * Directiva de accesibilidad para modales.
 *
 * Se aplica sobre el contenedor `.modal-backdrop` y:
 *  - Añade los roles `dialog` / `aria-modal` si no existen.
 *  - Mueve el foco al primer elemento interactivo al abrir.
 *  - Atrapa el foco (Tab / Shift+Tab) dentro del modal.
 *  - Cierra con la tecla Escape pulsando el botón `.btn-close` interno.
 *  - Cierra al hacer clic en el fondo (backdrop).
 *  - Restaura el foco al elemento que abrió el modal al destruirse.
 */
@Directive({
  selector: '[appModalA11y]',
  standalone: true
})
export class ModalA11yDirective implements OnInit, AfterViewInit, OnDestroy {
  private elementoPrevio: HTMLElement | null = null;

  constructor(private host: ElementRef<HTMLElement>) {}

  ngOnInit(): void {
    const el = this.host.nativeElement;
    if (!el.getAttribute('role')) {
      el.setAttribute('role', 'dialog');
    }
    el.setAttribute('aria-modal', 'true');

    this.elementoPrevio = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';
  }

  ngAfterViewInit(): void {
    // Mover el foco al primer control interactivo del modal (no al backdrop).
    const focusable = this.obtenerFocusables();
    if (focusable.length > 0) {
      focusable[0].focus();
    } else {
      this.host.nativeElement.setAttribute('tabindex', '-1');
      this.host.nativeElement.focus();
    }
  }

  ngOnDestroy(): void {
    document.body.style.overflow = '';
    this.elementoPrevio?.focus?.();
  }

  @HostListener('keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.cerrar();
      return;
    }

    if (event.key === 'Tab') {
      const focusables = this.obtenerFocusables();
      if (focusables.length === 0) {
        return;
      }
      const primero = focusables[0];
      const ultimo = focusables[focusables.length - 1];
      const activo = document.activeElement as HTMLElement;

      if (event.shiftKey && activo === primero) {
        event.preventDefault();
        ultimo.focus();
      } else if (!event.shiftKey && activo === ultimo) {
        event.preventDefault();
        primero.focus();
      }
    }
  }

  @HostListener('mousedown', ['$event'])
  onBackdropClick(event: MouseEvent): void {
    // Sólo cierra si el clic fue directamente sobre el backdrop, no en su contenido.
    if (event.target === this.host.nativeElement) {
      this.cerrar();
    }
  }

  private cerrar(): void {
    const btnClose = this.host.nativeElement.querySelector<HTMLElement>('.btn-close');
    if (btnClose) {
      btnClose.click();
    }
  }

  private obtenerFocusables(): HTMLElement[] {
    const selector = [
      'a[href]',
      'button:not([disabled])',
      'textarea:not([disabled])',
      'input:not([disabled]):not([type="hidden"])',
      'select:not([disabled])',
      '[tabindex]:not([tabindex="-1"])'
    ].join(',');

    return Array.from(
      this.host.nativeElement.querySelectorAll<HTMLElement>(selector)
    ).filter((el) => el.offsetParent !== null || el === document.activeElement);
  }
}
