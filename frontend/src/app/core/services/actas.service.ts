import { Injectable } from '@angular/core';
import * as pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';

const pdfMakeAny: any = pdfMake;
const pdfFontsAny: any = pdfFonts;
pdfMakeAny.vfs = pdfFontsAny.pdfMake ? pdfFontsAny.pdfMake.vfs : pdfFontsAny.vfs;

@Injectable({
  providedIn: 'root'
})
export class ActasService {

  constructor() { }

  /**
   * Generar y descargar el PDF de un acta de asamblea
   * @param evento Detalle del evento (título, fecha, lugar)
   * @param puntos Array de puntos tratados {orden, punto_tratar, tratado, resolucion}
   * @param asistenciaStats Opcional: Estadísticas de asistencia
   */
  generarActaPDF(evento: any, puntos: any[], asistenciaStats?: any[]) {
    const fechaStr = new Date(evento.fecha).toLocaleDateString('es-EC', { year: 'numeric', month: 'long', day: 'numeric' });
    const horaStr = evento.hora_inicio ? evento.hora_inicio.substring(0, 5) : '';

    const contenido: any[] = [];

    // Título / Encabezado
    contenido.push({ text: 'JUNTA DE AGUA Y RIEGO "LA JONES"', style: 'header' });
    contenido.push({ text: 'ACTA DE ASAMBLEA GENERAL', style: 'subheader' });
    contenido.push({ text: `\nLugar: ${evento.lugar || 'Casa Comunal'}` });
    contenido.push({ text: `Fecha: ${fechaStr}` });
    contenido.push({ text: `Hora de inicio: ${horaStr}\n\n` });

    contenido.push({ text: `En la ciudad de Patate, sector La Jones, siendo las ${horaStr} del día ${fechaStr}, se da inicio a la asamblea general bajo el siguiente orden del día:\n\n`, style: 'body' });

    // Orden del día
    puntos.forEach(p => {
      contenido.push({ text: `${p.orden}. ${p.punto_tratar}`, margin: [20, 0, 0, 5] });
    });

    contenido.push({ text: '\nDESARROLLO DE LA SESIÓN\n', style: 'sectionHeader' });

    // Desarrollo y Resoluciones
    puntos.forEach(p => {
      contenido.push({ text: `${p.orden}. ${p.punto_tratar}`, style: 'pointTitle' });
      contenido.push({ text: `Desarrollo: ${p.tratado || 'Sin observaciones.'}`, margin: [0, 0, 0, 5] });
      contenido.push({ text: `Resolución: ${p.resolucion || 'Sin resolución específica.'}`, margin: [0, 0, 0, 15], bold: true });
    });

    // Asistencia
    if (asistenciaStats && asistenciaStats.length > 0) {
      contenido.push({ text: '\nESTADÍSTICAS DE ASISTENCIA\n', style: 'sectionHeader' });
      const stats = asistenciaStats.map(s => `${s.estado}: ${s.total}`).join(', ');
      contenido.push({ text: stats, margin: [0, 0, 0, 20] });
    }

    contenido.push({ text: 'Sin más puntos que tratar, se levanta la sesión.\n\n\n\n', style: 'body' });

    // Firmas
    contenido.push({
      columns: [
        { text: '_________________________\nPresidente(a)', alignment: 'center' },
        { text: '_________________________\nSecretario(a)', alignment: 'center' }
      ]
    });

    const docDefinition = {
      content: contenido,
      styles: {
        header: {
          fontSize: 18,
          bold: true,
          alignment: 'center',
          margin: [0, 0, 0, 5]
        },
        subheader: {
          fontSize: 14,
          bold: true,
          alignment: 'center',
          margin: [0, 0, 0, 10]
        },
        sectionHeader: {
          fontSize: 12,
          bold: true,
          margin: [0, 10, 0, 10]
        },
        pointTitle: {
          fontSize: 11,
          bold: true,
          margin: [0, 10, 0, 5]
        },
        body: {
          fontSize: 11,
          alignment: 'justify'
        }
      },
      defaultStyle: {
        fontSize: 11
      }
    };

    // Crear y descargar el PDF
    pdfMake.createPdf(docDefinition as any).download(`Acta_Asamblea_${evento.fecha}.pdf`);
  }
}
