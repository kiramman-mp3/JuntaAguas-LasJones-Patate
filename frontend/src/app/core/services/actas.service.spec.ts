import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ActasService } from './actas.service';
import { NotificationService } from './notification.service';

const pdf = vi.hoisted(() => ({
  download: vi.fn(),
  createPdf: vi.fn(),
  addVirtualFileSystem: vi.fn()
}));

vi.mock('pdfmake/build/pdfmake', () => ({ default: { createPdf: pdf.createPdf, addVirtualFileSystem: pdf.addVirtualFileSystem } }));
vi.mock('pdfmake/build/vfs_fonts', () => ({ default: { 'Roboto-Regular.ttf': 'AAAA' } }));

describe('ActasService', () => {
  const notify = { error: vi.fn() };

  beforeEach(() => {
    pdf.createPdf.mockReturnValue({ download: pdf.download });
    TestBed.configureTestingModule({ providers: [{ provide: NotificationService, useValue: notify }] });
  });

  it('carga pdfmake al generar el PDF, registra las fuentes y descarga el archivo', async () => {
    const actas = TestBed.inject(ActasService);
    await actas.generarConvocatoriaPDF({ tipo: 'ASAMBLEA', titulo: 'Asamblea General', fecha: '2026-10-18', hora_inicio: '08:00:00', lugar: 'Casa comunal' });
    expect(pdf.addVirtualFileSystem).toHaveBeenCalledWith({ 'Roboto-Regular.ttf': 'AAAA' });
    expect(pdf.download).toHaveBeenCalledWith('Convocatoria_ASAMBLEA_2026-10-18.pdf');
    expect(notify.error).not.toHaveBeenCalled();
  });

  it('informa con una notificación si el PDF no se pudo generar', async () => {
    pdf.createPdf.mockImplementation(() => { throw new Error('fallo'); });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const actas = TestBed.inject(ActasService);
    await actas.generarConvocatoriaPDF({ tipo: 'MINGA', titulo: 'Minga', fecha: '2026-10-11', hora_inicio: '07:00:00' });
    expect(notify.error).toHaveBeenCalled();
  });
});
