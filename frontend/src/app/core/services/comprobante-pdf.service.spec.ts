import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Comprobante, ComprobantePdfService } from './comprobante-pdf.service';

describe('ComprobantePdfService.imprimir', () => {
  const comprobante = { numero: 'REC-0001' } as Comprobante;
  const doc = { autoPrint: vi.fn(), save: vi.fn(), output: vi.fn(() => 'blob:comprobante') };
  let servicio: ComprobantePdfService;

  const simularPantalla = (tactil: boolean) =>
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: tactil })),
    );

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    servicio = TestBed.inject(ComprobantePdfService);
    vi.spyOn(servicio as any, 'construir').mockResolvedValue(doc);
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    document.querySelectorAll('iframe').forEach((f) => f.remove());
  });

  it('en pantalla táctil abre el PDF en otra pestaña en lugar de usar un iframe oculto (H-28)', async () => {
    simularPantalla(true);
    const abrir = vi.spyOn(window, 'open').mockReturnValue({} as Window);

    await servicio.imprimir(comprobante);

    expect(abrir).toHaveBeenCalledWith('blob:comprobante', '_blank');
    expect(document.querySelector('iframe')).toBeNull();
    expect(doc.save).not.toHaveBeenCalled();
    vi.advanceTimersByTime(60_000);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:comprobante');
  });

  it('en pantalla táctil con la ventana bloqueada descarga el archivo y libera el blob', async () => {
    simularPantalla(true);
    vi.spyOn(window, 'open').mockReturnValue(null);

    await servicio.imprimir(comprobante);

    expect(doc.save).toHaveBeenCalledWith('REC-0001.pdf');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:comprobante');
  });

  it('en escritorio imprime desde un iframe oculto y lo retira si no llega a cargar', async () => {
    simularPantalla(false);
    const abrir = vi.spyOn(window, 'open');

    await servicio.imprimir(comprobante);

    const iframe = document.querySelector('iframe') as HTMLIFrameElement;
    expect(iframe).not.toBeNull();
    expect(abrir).not.toHaveBeenCalled();
    iframe.onerror?.(new Event('error'));
    expect(document.querySelector('iframe')).toBeNull();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:comprobante');
  });
});
