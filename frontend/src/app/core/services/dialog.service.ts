import { Injectable, signal } from '@angular/core';

export type DialogTipo = 'INFO' | 'WARNING' | 'DANGER' | 'CONFIRM';

export interface DialogOpciones {
  tipo?: DialogTipo;
  titulo: string;
  mensaje: string;
  textoConfirmar?: string;
  textoCancelar?: string;
  /** Si se define, el diálogo muestra un campo de texto (reemplazo de prompt). */
  placeholder?: string;
  valorInicial?: string;
  /**
   * Solo con `placeholder` (diálogo con campo de texto): valida el texto al confirmar. Si devuelve un mensaje, el diálogo
   * sigue abierto con ese error y lo escrito se conserva; con null se acepta.
   */
  validar?: (valor: string) => string | null;
}

interface DialogState {
  visible: boolean;
  tipo: DialogTipo;
  titulo: string;
  mensaje: string;
  textoConfirmar: string;
  textoCancelar: string;
  placeholder: string;
  valor: string;
  esPrompt: boolean;
  error: string;
  validar?: (valor: string) => string | null;
  resolver?: (valor: string | boolean | null) => void;
}

/**
 * Diálogos de confirmación/aviso/entrada no nativos.
 * Reemplazan window.confirm / window.alert / window.prompt.
 */
@Injectable({
  providedIn: 'root',
})
export class DialogService {
  readonly estado = signal<DialogState>(this.estadoInicial());

  private estadoInicial(): DialogState {
    return {
      visible: false,
      tipo: 'INFO',
      titulo: '',
      mensaje: '',
      textoConfirmar: 'Aceptar',
      textoCancelar: 'Cancelar',
      placeholder: '',
      valor: '',
      esPrompt: false,
      error: '',
      validar: undefined,
      resolver: undefined,
    };
  }

  confirmar(opciones: DialogOpciones): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      this.estado.set({
        ...this.estadoInicial(),
        visible: true,
        tipo: opciones.tipo ?? 'CONFIRM',
        titulo: opciones.titulo,
        mensaje: opciones.mensaje,
        textoConfirmar: opciones.textoConfirmar ?? 'Confirmar',
        textoCancelar: opciones.textoCancelar ?? 'Cancelar',
        resolver: (v) => resolve(!!v),
      });
    });
  }

  aviso(opciones: DialogOpciones): void {
    this.estado.set({
      ...this.estadoInicial(),
      visible: true,
      tipo: opciones.tipo ?? 'INFO',
      titulo: opciones.titulo,
      mensaje: opciones.mensaje,
      textoConfirmar: opciones.textoConfirmar ?? 'Entendido',
      textoCancelar: '',
      resolver: undefined,
    });
  }

  /** Reemplazo de window.prompt: devuelve el texto o null si se cancela. */
  solicitar(opciones: DialogOpciones): Promise<string | null> {
    return new Promise<string | null>((resolve) => {
      this.estado.set({
        ...this.estadoInicial(),
        visible: true,
        tipo: opciones.tipo ?? 'CONFIRM',
        titulo: opciones.titulo,
        mensaje: opciones.mensaje,
        textoConfirmar: opciones.textoConfirmar ?? 'Aceptar',
        placeholder: opciones.placeholder ?? '',
        valor: opciones.valorInicial ?? '',
        esPrompt: true,
        validar: opciones.validar,
        resolver: (v) => resolve(v ? String(v) : null),
      });
    });
  }

  setValor(valor: string): void {
    this.estado.update((e) => ({ ...e, valor, error: '' }));
  }

  responder(valor: boolean): void {
    const actual = this.estado();
    if (valor && actual.esPrompt && actual.validar) {
      const error = actual.validar(actual.valor);
      if (error) {
        this.estado.update((e) => ({ ...e, error }));
        return;
      }
    }
    actual.resolver?.(actual.esPrompt ? (valor ? actual.valor : null) : valor);
    this.estado.set({ ...this.estadoInicial() });
  }
}
