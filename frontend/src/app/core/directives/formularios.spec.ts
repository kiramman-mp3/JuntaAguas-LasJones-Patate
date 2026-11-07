import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { NotificationService } from '../services/notification.service';
import { AYUDAS_FORMULARIO } from './formularios';
import { aplicarMascara } from './mascara.directive';
import { mensajeValidacion } from './campo-error.directive';
import { ModalComponent } from '../../shared/ui/modal.component';
import { DialogService } from '../services/dialog.service';

@Component({
  standalone: true,
  imports: [FormsModule, ...AYUDAS_FORMULARIO],
  template: `
    <form (ngSubmit)="enviado()">
      <input id="nombre" name="nombre" [(ngModel)]="nombre" required />
      <input id="celular" name="celular" [(ngModel)]="celular" appMascara="celular" />
      <input
        id="telefono"
        name="telefono"
        [(ngModel)]="telefono"
        pattern="0[2-7][0-9]{7}"
        data-error-pattern="Teléfono de 9 dígitos."
      />
      <button type="submit">Guardar</button>
    </form>
  `,
})
class FormularioComponent {
  nombre = '';
  celular = '';
  telefono = '';
  enviado = vi.fn();
}

async function crear() {
  const notify = { warning: vi.fn(), success: vi.fn(), error: vi.fn(), info: vi.fn() };
  TestBed.configureTestingModule({
    providers: [{ provide: NotificationService, useValue: notify }],
  });
  const fixture = TestBed.createComponent(FormularioComponent);
  document.body.appendChild(fixture.nativeElement);
  fixture.detectChanges();
  await fixture.whenStable();
  const raiz = fixture.nativeElement as HTMLElement;
  return {
    fixture,
    raiz,
    notify,
    campo: (id: string) => raiz.querySelector<HTMLInputElement>('#' + id)!,
  };
}

function escribir(campo: HTMLInputElement, valor: string) {
  campo.value = valor;
  campo.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('Máscaras de entrada', () => {
  it('deja solo dígitos y respeta el largo de cada dato', () => {
    expect(aplicarMascara('1801-234 567ab89', 'cedula')).toBe('1801234567');
    expect(aplicarMascara('099 123 4567 999', 'celular')).toBe('0991234567');
    expect(aplicarMascara('03-287-0112', 'telefono')).toBe('032870112');
  });

  it('corrige lo que el usuario escribe o pega y actualiza el modelo', async () => {
    const { fixture, campo } = await crear();
    escribir(campo('celular'), '099-123-4567x');
    await fixture.whenStable();
    expect(campo('celular').value).toBe('0991234567');
    expect(fixture.componentInstance.celular).toBe('0991234567');
    expect(campo('celular').getAttribute('inputmode')).toBe('numeric');
  });
});

describe('Errores bajo cada campo', () => {
  it('no muestra nada hasta que el usuario sale del campo', async () => {
    const { raiz } = await crear();
    expect(raiz.querySelector('.field__error')).toBeNull();
  });

  it('explica el error al salir del campo y lo quita al corregirlo', async () => {
    const { fixture, raiz, campo } = await crear();
    campo('nombre').dispatchEvent(new Event('blur'));
    await fixture.whenStable();
    const aviso = raiz.querySelector('.field__error');
    expect(aviso?.textContent).toBe('Este dato es obligatorio.');
    expect(campo('nombre').getAttribute('aria-invalid')).toBe('true');
    expect(campo('nombre').getAttribute('aria-describedby')).toBe(aviso?.id);

    escribir(campo('nombre'), 'Juan Carlos');
    await fixture.whenStable();
    expect(raiz.querySelector('.field__error')).toBeNull();
    expect(campo('nombre').hasAttribute('aria-invalid')).toBe(false);
  });

  it('usa el mensaje propio del campo para el formato', async () => {
    const { fixture, raiz, campo } = await crear();
    escribir(campo('telefono'), '12345');
    campo('telefono').dispatchEvent(new Event('blur'));
    await fixture.whenStable();
    expect(raiz.textContent).toContain('Teléfono de 9 dígitos.');
  });

  it('traduce los validadores comunes a lenguaje cotidiano', () => {
    const campo = document.createElement('input');
    expect(mensajeValidacion({ email: true }, campo)).toContain('usuario@correo.com');
    expect(mensajeValidacion({ minlength: { requiredLength: 10 } }, campo)).toContain('10');
    expect(mensajeValidacion({ min: { min: 1 } }, campo)).toBe('El valor mínimo es 1.');
    expect(mensajeValidacion({ required: true }, document.createElement('select'))).toContain(
      'Seleccione',
    );
  });
});

describe('Revisión al enviar', () => {
  it('con datos faltantes no envía, marca los campos, enfoca el primero y avisa', async () => {
    const { fixture, raiz, campo, notify } = await crear();
    fixture.detectChanges();
    raiz.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();
    expect(fixture.componentInstance.enviado).not.toHaveBeenCalled();
    expect(raiz.querySelector('.field__error')).not.toBeNull();
    expect(notify.warning).toHaveBeenCalledOnce();
    expect(notify.warning.mock.calls[0][0]).toContain('Faltan datos');
    expect(document.activeElement).toBe(campo('nombre'));
  });

  it('con el formulario completo deja pasar el envío', async () => {
    const { fixture, raiz, campo, notify } = await crear();
    escribir(campo('nombre'), 'Juan Carlos');
    await fixture.whenStable();
    raiz.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(fixture.componentInstance.enviado).toHaveBeenCalledOnce();
    expect(notify.warning).not.toHaveBeenCalled();
  });
});

@Component({
  standalone: true,
  imports: [ModalComponent, FormsModule],
  template: `
    <app-modal titulo="Prueba" [sinGuardar]="marcado()" (cerrar)="cerrado = true">
      <input id="texto" name="texto" [(ngModel)]="texto" />
      <input id="buscar" type="search" [ngModel]="''" />
      <button type="button" id="cancelar" data-cancelar>Cancelar</button>
    </app-modal>
  `,
})
class ModalHostComponent {
  texto = '';
  marcado = signal(false);
  cerrado = false;
}

/** Los modales de pruebas anteriores siguen en el DOM mientras corre su animación de salida. */
function ultimo<T extends Element>(selector: string): T {
  return Array.from(document.querySelectorAll<T>(selector)).at(-1)!;
}

describe('Cerrar un modal con datos sin guardar', () => {
  function abrir(confirma: boolean) {
    const confirmarDescartar = vi.fn(() => Promise.resolve(confirma));
    TestBed.configureTestingModule({
      providers: [{ provide: DialogService, useValue: { confirmarDescartar } }],
    });
    const fixture = TestBed.createComponent(ModalHostComponent);
    fixture.detectChanges();
    const cerrarConX = async () => {
      ultimo<HTMLButtonElement>('.btn-close').click();
      await fixture.whenStable();
      await Promise.resolve();
    };
    const cerrarConCancelar = async () => {
      ultimo<HTMLButtonElement>('#cancelar').click();
      await fixture.whenStable();
      await Promise.resolve();
    };
    return { fixture, confirmarDescartar, cerrarConX, cerrarConCancelar };
  }

  it('cierra sin preguntar si no se escribió nada', async () => {
    const { fixture, confirmarDescartar, cerrarConX } = abrir(true);
    await cerrarConX();
    expect(confirmarDescartar).not.toHaveBeenCalled();
    expect(fixture.componentInstance.cerrado).toBe(true);
  });

  it('un buscador no cuenta como datos sin guardar', async () => {
    const { fixture, confirmarDescartar, cerrarConX } = abrir(true);
    escribir(ultimo<HTMLInputElement>('#buscar'), 'rosa');
    await cerrarConX();
    expect(confirmarDescartar).not.toHaveBeenCalled();
    expect(fixture.componentInstance.cerrado).toBe(true);
  });

  it('pregunta si se escribió y se queda abierto si el usuario decide seguir editando', async () => {
    const { fixture, confirmarDescartar, cerrarConX } = abrir(false);
    escribir(ultimo<HTMLInputElement>('#texto'), 'a medias');
    await cerrarConX();
    expect(confirmarDescartar).toHaveBeenCalledOnce();
    expect(fixture.componentInstance.cerrado).toBe(false);
  });

  it('cierra si el usuario acepta salir sin guardar', async () => {
    const { fixture, confirmarDescartar, cerrarConX } = abrir(true);
    escribir(ultimo<HTMLInputElement>('#texto'), 'a medias');
    await cerrarConX();
    expect(confirmarDescartar).toHaveBeenCalledOnce();
    expect(fixture.componentInstance.cerrado).toBe(true);
  });

  it('el botón Cancelar del pie pregunta igual que la X si se escribió algo', async () => {
    const { fixture, confirmarDescartar, cerrarConCancelar } = abrir(false);
    escribir(ultimo<HTMLInputElement>('#texto'), 'a medias');
    await cerrarConCancelar();
    expect(confirmarDescartar).toHaveBeenCalledOnce();
    expect(fixture.componentInstance.cerrado).toBe(false);
  });

  it('el botón Cancelar cierra sin preguntar si no se escribió nada', async () => {
    const { fixture, confirmarDescartar, cerrarConCancelar } = abrir(true);
    await cerrarConCancelar();
    expect(confirmarDescartar).not.toHaveBeenCalled();
    expect(fixture.componentInstance.cerrado).toBe(true);
  });

  it('también pregunta cuando el consumidor avisa de cambios sin guardar', async () => {
    const { fixture, confirmarDescartar, cerrarConX } = abrir(false);
    fixture.componentInstance.marcado.set(true);
    fixture.detectChanges();
    await cerrarConX();
    expect(confirmarDescartar).toHaveBeenCalledOnce();
  });
});
