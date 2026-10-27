import { Component } from '@angular/core';

/**
 * Curvas de nivel de un valle con andenes: adorno de las cabeceras públicas, a la derecha y difuminado
 * hacia la izquierda para no competir con el título. Es decorativo (oculto a lectores de pantalla).
 */
@Component({
  selector: 'app-curvas-nivel',
  standalone: true,
  template: `
    <svg
      viewBox="0 0 900 360"
      preserveAspectRatio="xMaxYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <path id="curva-a" d="M0 330 C110 300 190 340 310 305 S520 215 620 245 S770 190 900 160" />
        <path id="curva-b" d="M0 322 C130 280 210 330 330 292 S510 230 640 232 S780 196 900 176" />
      </defs>
      <use href="#curva-a" />
      <use href="#curva-b" transform="translate(0 -26)" />
      <use href="#curva-a" transform="translate(0 -52)" />
      <use href="#curva-b" transform="translate(0 -78)" />
      <use href="#curva-a" transform="translate(0 -104)" />
      <use href="#curva-b" transform="translate(0 -130)" />
      <use href="#curva-a" transform="translate(0 -156)" />
      <use href="#curva-b" transform="translate(0 -182)" />
      <use href="#curva-a" transform="translate(0 -208)" />
      <use href="#curva-b" transform="translate(0 -234)" />
    </svg>
  `,
  styles: `
    :host {
      position: absolute;
      inset: 0;
      z-index: -1;
      overflow: hidden;
      pointer-events: none;
      color: var(--color-primary);
    }

    svg {
      position: absolute;
      right: 0;
      top: 0;
      width: min(900px, 100%);
      height: 100%;
      opacity: 0.2;
      -webkit-mask-image: linear-gradient(to left, #000 25%, transparent 92%);
      mask-image: linear-gradient(to left, #000 25%, transparent 92%);
    }

    use {
      fill: none;
      stroke: currentColor;
      stroke-width: 1.25;
      vector-effect: non-scaling-stroke;
    }
  `,
})
export class CurvasNivelComponent {}
