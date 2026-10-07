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
  resolver?: (valor: any) => void;
}

/**
 * Diálogos de confirmación/aviso/entrada no nativos.
 * Reemplazan window.confirm / window.alert / window.prompt.
 */
@Injectable({
  providedIn: 'root'
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
      resolver: undefined
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
        resolver: (v) => resolve(!!v)
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
      resolver: undefined
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
        resolver: (v) => resolve(v ? String(v) : null)
      });
    });
  }

  setValor(valor: string): void {
    this.estado.update((e) => ({ ...e, valor }));
  }

  responder(valor: boolean): void {
    const actual = this.estado();
    actual.resolver?.(actual.esPrompt ? (valor ? actual.valor : null) : valor);
    this.estado.set({ ...this.estadoInicial() });
  }
}
