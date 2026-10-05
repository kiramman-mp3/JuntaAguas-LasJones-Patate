import { Injectable, signal } from '@angular/core';

export type ToastTipo = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: number;
  tipo: ToastTipo;
  mensaje: string;
}

/**
 * Sistema de notificaciones no bloqueantes (toasts).
 * Reemplaza los `alert()`/`confirm()` nativos, mejorando la UX.
 */
@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  readonly toasts = signal<Toast[]>([]);
  private contador = 0;

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
    this.toasts.update((lista) => lista.filter((t) => t.id !== id));
  }

  private mostrar(tipo: ToastTipo, mensaje: string) {
    if (!mensaje) return;
    const id = ++this.contador;
    this.toasts.update((lista) => [...lista, { id, tipo, mensaje }]);
    setTimeout(() => this.cerrar(id), 5000);
  }
}
