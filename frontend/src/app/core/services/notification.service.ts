import { Injectable, signal } from '@angular/core';

export type ToastTipo = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: number;
  tipo: ToastTipo;
  mensaje: string;
}

/** Los errores y advertencias necesitan más tiempo de lectura que una confirmación. */
const DURACION: Record<ToastTipo, number> = {
  success: 4000,
  info: 5000,
  warning: 6500,
  error: 7000
};

const MAXIMO_VISIBLES = 4;

/**
 * Sistema de notificaciones no bloqueantes (toasts).
 * Reemplaza los `alert()`/`confirm()` nativos. El temporizador se pausa mientras
 * el usuario lee (cursor encima o foco) y un mismo mensaje no se apila dos veces.
 */
@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  readonly toasts = signal<Toast[]>([]);
  private contador = 0;
  private temporizadores = new Map<number, { timer: ReturnType<typeof setTimeout> | null; restante: number; inicio: number }>();

  success(mensaje: string) {
    this.mostrar('success', mensaje);
  }

  error(mensaje: string) {
    this.mostrar('error', mensaje);
  }

  info(mensaje: string) {
    this.mostrar('info', mensaje);
  }

  warning(mensaje: string) {
    this.mostrar('warning', mensaje);
  }

  cerrar(id: number) {
    const t = this.temporizadores.get(id);
    if (t?.timer) clearTimeout(t.timer);
    this.temporizadores.delete(id);
    this.toasts.update((lista) => lista.filter((toast) => toast.id !== id));
  }

  pausar(id: number) {
    const t = this.temporizadores.get(id);
    if (!t?.timer) return;
    clearTimeout(t.timer);
    t.timer = null;
    t.restante -= Date.now() - t.inicio;
  }

  reanudar(id: number) {
    const t = this.temporizadores.get(id);
    if (!t || t.timer) return;
    t.inicio = Date.now();
    t.timer = setTimeout(() => this.cerrar(id), Math.max(t.restante, 1200));
  }

  private mostrar(tipo: ToastTipo, mensaje: string) {
    if (!mensaje) return;
    const repetido = this.toasts().find((t) => t.tipo === tipo && t.mensaje === mensaje);
    if (repetido) {
      // Reinicia el tiempo del aviso existente en lugar de duplicarlo.
      this.cerrarTemporizador(repetido.id);
      this.programar(repetido.id, DURACION[tipo]);
      return;
    }
    const id = ++this.contador;
    this.toasts.update((lista) => {
      const nueva = [...lista, { id, tipo, mensaje }];
      for (const sobrante of nueva.slice(0, Math.max(0, nueva.length - MAXIMO_VISIBLES))) this.cerrarTemporizador(sobrante.id);
      return nueva.slice(-MAXIMO_VISIBLES);
    });
    this.programar(id, DURACION[tipo]);
  }

  private programar(id: number, duracion: number) {
    this.temporizadores.set(id, { timer: setTimeout(() => this.cerrar(id), duracion), restante: duracion, inicio: Date.now() });
  }

  private cerrarTemporizador(id: number) {
    const t = this.temporizadores.get(id);
    if (t?.timer) clearTimeout(t.timer);
    this.temporizadores.delete(id);
  }
}
