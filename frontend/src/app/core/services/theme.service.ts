import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'junta_theme';
type Theme = 'light' | 'dark';

/**
 * Servicio de tema claro/oscuro.
 * Aplica el atributo [data-theme] en <html> y persiste la preferencia.
 */
@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  readonly theme = signal<Theme>('light');

  constructor() {
    this.inicializar();
  }

  private inicializar() {
    const guardado = this.leerGuardado();
    const prefiereOscuro = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    const inicial: Theme = guardado ?? (prefiereOscuro ? 'dark' : 'light');
    this.aplicar(inicial);
  }

  toggle() {
    this.aplicar(this.theme() === 'dark' ? 'light' : 'dark');
  }

  private aplicar(theme: Theme) {
    this.theme.set(theme);
    document.documentElement.setAttribute('data-theme', theme);
    this.guardar(theme);
  }

  /** Lectura segura: localStorage puede no existir en SSR o en pruebas. */
  private leerGuardado(): Theme | null {
    try {
      return (localStorage.getItem(STORAGE_KEY) as Theme | null);
    } catch {
      return null;
    }
  }

  private guardar(theme: Theme): void {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* almacenamiento no disponible */
    }
  }
}
