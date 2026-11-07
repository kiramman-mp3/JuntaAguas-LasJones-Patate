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
    setFont() {
      return this;
    }
    setFontSize() {
      return this;
    }
    setTextColor() {
      return this;
    }
    text(texto: string) {
      pdf.textos.push(texto);
      return this;
    }
    splitTextToSize(texto: string) {
      return [texto];
    }
    addPage() {
      return this;
    }
    save(nombre: string) {
      pdf.save(nombre);
    }
  }
  return {
    jsPDF: DocFalso,
    autoTable: (doc: { lastAutoTable?: { finalY: number } }, opciones: { body: string[][] }) => {
      for (const fila of opciones.body) pdf.textos.push(fila.join(' '));
      doc.lastAutoTable = { finalY: 100 };
    },
  };
};

describe('ActasService', () => {
  const notify = { error: vi.fn() };

  beforeEach(() => {
    pdf.textos = [];
    pdf.fallar = false;
    pdf.save.mockReset();
    notify.error.mockReset();
    TestBed.configureTestingModule({
      providers: [
        { provide: NotificationService, useValue: notify },
        { provide: CARGADOR_JSPDF, useValue: cargadorFalso },
      ],
    });
  });

  it('genera la convocatoria con jsPDF, con la fecha del evento en Ecuador, y la descarga', async () => {
    const actas = TestBed.inject(ActasService);
    await actas.generarConvocatoriaPDF({
      tipo: 'ASAMBLEA',
      titulo: 'Asamblea General',
      fecha: '2026-10-18',
      hora_inicio: '08:00:00',
      lugar: 'Casa comunal',
    });
    expect(pdf.save).toHaveBeenCalledWith('Convocatoria_ASAMBLEA_2026-10-18.pdf');
    expect(pdf.textos).toContain('Patate, 18 de octubre de 2026');
    expect(pdf.textos).toContain('Hora de Inicio: 08:00 hs');
    expect(pdf.textos).toEqual(
      expect.arrayContaining([
        'Ramiro Cepeda Caicedo',
        'Presidente',
        'C.I. 1801701366',
        'John Mora Pérez',
        'Secretario',
        'C.I. 1801371327',
      ]),
    );
    expect(notify.error).not.toHaveBeenCalled();
  });

  it('la convocatoria nombra el sector convocado, o todos los sectores si no hay uno', async () => {
    const actas = TestBed.inject(ActasService);
    const base = {
      tipo: 'ASAMBLEA',
      titulo: 'Asamblea',
      fecha: '2026-10-18',
      hora_inicio: '08:00:00',
    };
    await actas.generarConvocatoriaPDF({ ...base, sector_nombre: 'San Javier' });
    expect(pdf.textos).toContain(
      'Se convoca con carácter de OBLIGATORIO a todos los usuarios pertenecientes a la Junta de Riego La Jones - Patate, sector San Javier a participar en el siguiente evento programado:',
    );
    expect(pdf.textos).toContain('Sector: San Javier');

    pdf.textos = [];
    await actas.generarConvocatoriaPDF(base);
    expect(pdf.textos.join(' ')).not.toContain(', sector');
    expect(pdf.textos).toContain('Sector: Todos los sectores');
  });

  it('el acta numera los puntos del orden del día después de los dos fijos', async () => {
    const actas = TestBed.inject(ActasService);
    await actas.generarActaPDF(
      { id: 4, fecha: '2026-03-01', hora_inicio: '09:00' },
      [
        { orden: 1, punto_tratar: 'Constatación del cuórum' },
        { orden: 3, punto_tratar: 'Informe de tesorería', resolucion: 'Se aprueba el informe' },
        { orden: 4, punto_tratar: 'Varios' },
      ],
      [
        { estado: 'PRESENTE', total: 40 },
        { estado: 'AUSENTE', total: 10 },
      ],
    );
    expect(pdf.save).toHaveBeenCalledWith('Acta_Asamblea_2026-03-01.pdf');
    expect(pdf.textos).toContain('PUNTO 3. INFORME DE TESORERÍA');
    expect(pdf.textos).toContain('PUNTO 4. VARIOS');
    expect(pdf.textos).toContain('Usuarios presentes: 40');
  });

  it('el acta nombra a la directiva y completa sus datos sin dejar espacios en blanco', async () => {
    const actas = TestBed.inject(ActasService);
    await actas.generarActaPDF(
      { id: 4, fecha: '2026-03-01', hora_inicio: '09:00', sector_nombre: 'San Javier' },
      [],
      [
        { estado: 'PRESENTE', total: 30 },
        { estado: 'AUSENTE', total: 20 },
      ],
    );
    const texto = pdf.textos.join(' ');
    expect(texto).toContain(
      'Preside la Asamblea el señor Ramiro Cepeda Caicedo, Presidente de la Junta de Riego La Jones - Patate, y actúa como Secretario el señor John Mora Pérez.',
    );
    expect(texto).toContain('se reúnen los usuarios del sector San Javier de la Junta de Riego');
    expect(texto).toContain(
      'verificándose la presencia de 30 usuarios de un total de 50 usuarios registrados',
    );
    expect(texto).toContain('Cuórum requerido: 50% + 1 de los usuarios registrados (26)');
    expect(texto).toContain('Cuórum constatado: Existe cuórum reglamentario');
    expect(texto).toContain('declara clausurada la Asamblea General el día 1 de marzo de 2026.');
    expect(pdf.textos).toEqual(expect.arrayContaining(['C.I. 1801701366', 'C.I. 1801371327']));
    // Solo quedan las rayas donde se firma: ningún dato del acta queda en blanco.
    expect(pdf.textos.filter((t) => t.includes('____') && !/^_+$/.test(t))).toEqual([]);
  });

  it('el acta no repite el punto del acta anterior ni duplica la numeración de los títulos', async () => {
    const actas = TestBed.inject(ActasService);
    await actas.generarActaPDF(
      { id: 6, fecha: '2026-03-01', hora_inicio: '09:00' },
      [
        { orden: 1, punto_tratar: '1. Constatación del cuórum reglamentario' },
        { orden: 2, punto_tratar: '2. Lectura y aprobación del acta de la asamblea anterior' },
        { orden: 3, punto_tratar: '3. Informe de presidencia y balance financiero' },
        { orden: 4, punto_tratar: '4. Asuntos varios y resoluciones' },
      ],
      [{ estado: 'PRESENTE', total: 10 }],
    );
    const secciones = pdf.textos.filter((t) => t.startsWith('PUNTO') || t.startsWith('Punto'));
    expect(secciones).toEqual([
      'Punto 1. CONSTATACIÓN DEL CUÓRUM',
      'Punto 2. LECTURA Y APROBACIÓN DEL ACTA ANTERIOR',
      'PUNTO 3. INFORME DE PRESIDENCIA Y BALANCE FINANCIERO',
      'PUNTO 4. VARIOS',
    ]);
  });

  it('el acta dice que no hay cuórum cuando los presentes no alcanzan la mitad más uno', async () => {
    const actas = TestBed.inject(ActasService);
    await actas.generarActaPDF(
      { id: 5, fecha: '2026-03-01', hora_inicio: '09:00', hora_fin: '11:30:00' },
      [],
      [
        { estado: 'PRESENTE', total: 10 },
        { estado: 'AUSENTE', total: 40 },
      ],
    );
    const texto = pdf.textos.join(' ');
    expect(texto).toContain('Cuórum constatado: No existe cuórum reglamentario');
    expect(texto).toContain('a las 11:30 horas del día 1 de marzo de 2026');
  });

  it('informa con una notificación si el PDF no se pudo generar', async () => {
    pdf.fallar = true;
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const actas = TestBed.inject(ActasService);
    await actas.generarConvocatoriaPDF({
      tipo: 'MINGA',
      titulo: 'Minga',
      fecha: '2026-10-11',
      hora_inicio: '07:00:00',
    });
    expect(notify.error).toHaveBeenCalled();
    expect(pdf.save).not.toHaveBeenCalled();
  });
});
