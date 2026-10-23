import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ActasService } from './actas.service';
import { NotificationService } from './notification.service';
import { CARGADOR_JSPDF } from '../utils/jspdf';

const pdf = vi.hoisted(() => ({ save: vi.fn(), textos: [] as string[], fallar: false }));

const cargadorFalso = async () => {
    if (pdf.fallar) throw new Error('sin red');
    class DocFalso {
      internal = { pageSize: { getWidth: () => 595, getHeight: () => 842 } };
      setFont() { return this; }
      setFontSize() { return this; }
      setTextColor() { return this; }
      text(texto: string) { pdf.textos.push(texto); return this; }
      splitTextToSize(texto: string) { return [texto]; }
      addPage() { return this; }
      save(nombre: string) { pdf.save(nombre); }
    }
    return { jsPDF: DocFalso, autoTable: (doc: { lastAutoTable?: { finalY: number } }, opciones: { body: string[][] }) => {
      for (const fila of opciones.body) pdf.textos.push(fila.join(' '));
      doc.lastAutoTable = { finalY: 100 };
    } };
};

describe('ActasService', () => {
  const notify = { error: vi.fn() };

  beforeEach(() => {
    pdf.textos = [];
    pdf.fallar = false;
    pdf.save.mockReset();
    notify.error.mockReset();
    TestBed.configureTestingModule({ providers: [
      { provide: NotificationService, useValue: notify },
      { provide: CARGADOR_JSPDF, useValue: cargadorFalso }
    ] });
  });

  it('genera la convocatoria con jsPDF, con la fecha del evento en Ecuador, y la descarga', async () => {
    const actas = TestBed.inject(ActasService);
    await actas.generarConvocatoriaPDF({ tipo: 'ASAMBLEA', titulo: 'Asamblea General', fecha: '2026-10-18', hora_inicio: '08:00:00', lugar: 'Casa comunal' });
    expect(pdf.save).toHaveBeenCalledWith('Convocatoria_ASAMBLEA_2026-10-18.pdf');
    expect(pdf.textos).toContain('Patate, 18 de octubre de 2026');
    expect(pdf.textos).toContain('Hora de Inicio: 08:00 hs');
    expect(notify.error).not.toHaveBeenCalled();
  });

  it('el acta numera los puntos del orden del día después de los dos fijos', async () => {
    const actas = TestBed.inject(ActasService);
    await actas.generarActaPDF({ id: 4, fecha: '2026-03-01', hora_inicio: '09:00' }, [
      { orden: 1, punto_tratar: 'Constatación del cuórum' },
      { orden: 3, punto_tratar: 'Informe de tesorería', resolucion: 'Se aprueba el informe' },
      { orden: 4, punto_tratar: 'Varios' }
    ], [{ estado: 'PRESENTE', total: 40 }, { estado: 'AUSENTE', total: 10 }]);
    expect(pdf.save).toHaveBeenCalledWith('Acta_Asamblea_2026-03-01.pdf');
    expect(pdf.textos).toContain('PUNTO 3. INFORME DE TESORERÍA');
    expect(pdf.textos).toContain('PUNTO 4. VARIOS');
    expect(pdf.textos).toContain('Usuarios presentes: 40');
  });

  it('informa con una notificación si el PDF no se pudo generar', async () => {
    pdf.fallar = true;
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const actas = TestBed.inject(ActasService);
    await actas.generarConvocatoriaPDF({ tipo: 'MINGA', titulo: 'Minga', fecha: '2026-10-11', hora_inicio: '07:00:00' });
    expect(notify.error).toHaveBeenCalled();
    expect(pdf.save).not.toHaveBeenCalled();
  });
});
