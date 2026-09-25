import { Injectable } from '@angular/core';
import * as pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';

const pdfMakeInstance: any = (pdfMake as any).default || pdfMake;
const pdfFontsInstance: any = (pdfFonts as any).default || pdfFonts;

try {
  if (pdfFontsInstance && pdfFontsInstance.pdfMake && pdfFontsInstance.pdfMake.vfs) {
    pdfMakeInstance.vfs = pdfFontsInstance.pdfMake.vfs;
  } else if (pdfFontsInstance && pdfFontsInstance.vfs) {
    pdfMakeInstance.vfs = pdfFontsInstance.vfs;
  } else if ((pdfFonts as any).vfs) {
    pdfMakeInstance.vfs = (pdfFonts as any).vfs;
  }
} catch (e) {
  console.warn('Error inicializando vfs para pdfMake:', e);
}

@Injectable({
  providedIn: 'root'
})
export class ActasService {

  constructor() { }

  /**
   * Generar y descargar el PDF oficial de un acta de asamblea finalizada
   * @param evento Detalle del evento (título, fecha, lugar, presidente, secretario, etc.)
   * @param puntos Array de puntos tratados {orden, punto_tratar, tratado, resolucion}
   * @param asistenciaStats Opcional: Estadísticas de asistencia
   */
  generarActaPDF(evento: any, puntos: any[] = [], asistenciaStats?: any[]) {
    const fechaObj = evento.fecha ? new Date(evento.fecha) : new Date();
    // Prevenir desfasaje UTC
    const dateParts = typeof evento.fecha === 'string' ? evento.fecha.split('T')[0].split('-') : [];
    const dia = dateParts.length === 3 ? parseInt(dateParts[2], 10) : fechaObj.getDate();
    const mesIdx = dateParts.length === 3 ? parseInt(dateParts[1], 10) - 1 : fechaObj.getMonth();
    const anio = dateParts.length === 3 ? parseInt(dateParts[0], 10) : fechaObj.getFullYear();

    const meses = [
      'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
    ];
    const mesNombre = meses[mesIdx] || '__________';
    const fechaTexto = `${dia} de ${mesNombre} de ${anio}`;

    const horaInicio = evento.hora_inicio ? evento.hora_inicio.substring(0, 5) : '________';
    const horaClausura = evento.hora_fin ? evento.hora_fin.substring(0, 5) : (evento.hora_clausura || '________');
    const subtipo = (evento.subtipo_asamblea || 'ORDINARIA').toUpperCase();

    // Stats de Asistencia
    let presentesCount = evento.usuarios_presentes || '______';
    let totalUsuariosCount = evento.total_usuarios || '______';
    if (asistenciaStats && Array.isArray(asistenciaStats)) {
      const presObj = asistenciaStats.find(s => (s.estado || '').toUpperCase() === 'PRESENTE');
      if (presObj) presentesCount = presObj.total;
      const totalSum = asistenciaStats.reduce((acc, curr) => acc + (parseInt(curr.total, 10) || 0), 0);
      if (totalSum > 0) totalUsuariosCount = totalSum;
    }

    const presidente = evento.presidente || '____________________________________________';
    const secretario = evento.secretario || '____________________________________________';
    const lugar = evento.lugar || 'sede de la organización';
    const sector = evento.sector || 'Patate Centro';
    const numeroActa = evento.numero_acta || `N.º ${evento.id || '___'}`;

    const contenido: any[] = [];

    // --- ENCABEZADO PRINCIPAL ---
    contenido.push({ text: 'JUNTA DE RIEGO LA JONES - PATATE', style: 'docTitle' });
    contenido.push({ text: 'ACTA DE ASAMBLEA GENERAL', style: 'docSubtitle' });
    contenido.push({
      text: subtipo === 'EXTRAORDINARIA' ? 'EXTRAORDINARIA' : 'ORDINARIA',
      style: 'docType'
    });

    // --- TABLA DE METADATOS INICIAL ---
    contenido.push({
      margin: [0, 10, 0, 15],
      table: {
        widths: [130, '*'],
        body: [
          [{ text: 'Acta N.º', bold: true }, { text: numeroActa }],
          [{ text: 'Fecha', bold: true }, { text: fechaTexto }],
          [{ text: 'Hora de inicio', bold: true }, { text: `${horaInicio} hs` }]
        ]
      },
      layout: {
        hLineWidth: () => 0.5,
        vLineWidth: () => 0.5,
        hLineColor: () => '#555555',
        vLineColor: () => '#555555'
      }
    });

    // --- TEXTO INTRODUCTORIO ---
    contenido.push({
      text: `En la sede de la organización ubicada en ${lugar}, sector ${sector}, cantón Patate, provincia de Tungurahua, a los ${dia} días del mes de ${mesNombre} del año ${anio}, siendo las ${horaInicio} horas, se reúnen los usuarios de la Junta de Riego La Jones - Patate, previa convocatoria realizada de conformidad con las disposiciones correspondientes, con el objeto de celebrar la Asamblea General ${subtipo === 'EXTRAORDINARIA' ? 'Extraordinaria' : 'Ordinaria'}.\n\n`,
      style: 'paragraph'
    });

    // --- INSTALACIÓN DE LA ASAMBLEA ---
    contenido.push({ text: 'INSTALACIÓN DE LA ASAMBLEA', style: 'sectionTitle' });
    contenido.push({
      text: `Preside la Asamblea el señor ${presidente}, Presidente de la Junta de Riego La Jones - Patate, y actúa como Secretario/a el/la señor/a ${secretario}.\n`,
      style: 'paragraph'
    });
    contenido.push({ text: 'El señor Presidente da la bienvenida a los usuarios presentes.\n\n', style: 'paragraph' });

    // --- PUNTO 1. CONSTATACIÓN DEL CUÓRUM ---
    contenido.push({ text: 'Punto 1. CONSTATACIÓN DEL CUÓRUM', style: 'sectionTitle' });
    contenido.push({
      text: `El/la Secretario/a procede a constatar la asistencia de los usuarios convocados, mediante las firmas constantes en las hojas de asistencia de los sectores: Patate Viejo, La Merced y San Javier, verificándose la presencia de ${presentesCount} usuarios de un total de ${totalUsuariosCount} usuarios registrados.\n`,
      style: 'paragraph'
    });
    contenido.push({ text: `Usuarios presentes: ${presentesCount}`, style: 'bulletField' });
    contenido.push({ text: `Cuórum requerido: ${evento.cuorum_requerido || '50% + 1 de los usuarios registrados'}`, style: 'bulletField' });
    contenido.push({ text: `Cuórum constatado: ${evento.cuorum_constatado || (presentesCount !== '______' ? 'Existe cuórum reglamentario' : '______________________________')}\n`, style: 'bulletField' });
    contenido.push({ text: 'Una vez cumplidos los requisitos correspondientes, se declara instalada la Asamblea.\n\n', style: 'paragraph' });

    // --- PUNTO 2. LECTURA Y APROBACIÓN DEL ACTA ANTERIOR ---
    contenido.push({ text: 'Punto 2. LECTURA Y APROBACIÓN DEL ACTA ANTERIOR', style: 'sectionTitle' });
    contenido.push({
      text: 'El/la Secretario/a procede a dar lectura al acta de la Asamblea General anterior.\nUna vez concluida la lectura, el señor Presidente pone el acta a consideration de los usuarios presentes.\n',
      style: 'paragraph'
    });
    contenido.push({ text: 'Resolución:', bold: true, margin: [0, 2, 0, 2] });
    const punto2Obj = puntos.find(p => p.orden === 2 || (p.punto_tratar && p.punto_tratar.toLowerCase().includes('acta anterior')));
    contenido.push({
      text: punto2Obj?.resolucion || evento.resolucion_acta_anterior || 'El acta de la asamblea anterior es aprobada sin observaciones por la unanimidad de los usuarios presentes.',
      style: 'paragraphContent'
    });
    contenido.push({ text: '\nEl acta es aprobada / aprobada con observaciones por los usuarios presentes.\n\n', style: 'paragraph' });

    // --- PUNTOS RESTANTES DEL ORDEN DEL DÍA (3, 4, 5...) ---
    const puntosDinamicos = puntos.filter(p => {
      const lower = (p.punto_tratar || '').toLowerCase();
      return !lower.includes('cuórum') && !lower.includes('cuorum') && !lower.includes('acta anterior') && !lower.includes('varios');
    });

    let numPunto = 3;
    puntosDinamicos.forEach((p) => {
      contenido.push({
        text: `PUNTO ${numPunto}. ${(p.punto_tratar || '').toUpperCase()}`,
        style: 'sectionTitle'
      });
      contenido.push({ text: 'Desarrollo:', bold: true, margin: [0, 2, 0, 2] });
      contenido.push({ text: p.tratado || p.desarrollo || '____________________________________________________________________________', style: 'paragraphContent' });
      contenido.push({ text: '\nResolución / Resoluciones:', bold: true, margin: [0, 2, 0, 2] });
      contenido.push({ text: p.resolucion || '____________________________________________________________________________\n\n', style: 'paragraphContent' });
      numPunto++;
    });

    // --- PUNTO VARIOS ---
    const puntoVarios = puntos.find(p => (p.punto_tratar || '').toLowerCase().includes('varios'));
    contenido.push({ text: `PUNTO ${numPunto}. VARIOS`, style: 'sectionTitle' });
    contenido.push({ text: 'Durante este punto, los usuarios presentan los siguientes asuntos:', style: 'paragraph' });
    contenido.push({
      text: puntoVarios?.tratado || evento.varios_desarrollo || '____________________________________________________________________________',
      style: 'paragraphContent'
    });
    contenido.push({ text: '\nResoluciones / Acuerdos:', bold: true, margin: [0, 4, 0, 2] });
    contenido.push({
      text: puntoVarios?.resolucion || evento.varios_resolucion || '____________________________________________________________________________\n\n',
      style: 'paragraphContent'
    });

    // --- CLAUSURA ---
    contenido.push({ text: 'CLAUSURA', style: 'sectionTitle' });
    contenido.push({
      text: `Una vez tratados todos los puntos constantes en el orden del día, y no habiendo más asuntos que tratar, el señor Presidente agradece la presencia y participación de los usuarios y declara clausurada la Asamblea General a las ${horaClausura} horas del día ${fechaTexto}.\n\nPara constancia de lo actuado, se suscribe la presente acta.\n\n`,
      style: 'paragraph'
    });

    // --- FIRMAS EN CAJA ---
    contenido.push({
      margin: [0, 15, 0, 15],
      table: {
        widths: ['50%', '50%'],
        body: [
          [
            {
              margin: [10, 15, 10, 15],
              stack: [
                { text: '\n\n__________________________________', alignment: 'center' },
                { text: `Sr. ${presidente}`, bold: true, alignment: 'center' },
                { text: 'PRESIDENTE', bold: true, alignment: 'center' },
                { text: 'Junta de Riego La Jones - Patate', alignment: 'center' }
              ]
            },
            {
              margin: [10, 15, 10, 15],
              stack: [
                { text: '\n\n__________________________________', alignment: 'center' },
                { text: `Sr./Sra. ${secretario}`, bold: true, alignment: 'center' },
                { text: 'SECRETARIO/A', bold: true, alignment: 'center' },
                { text: 'Junta de Riego La Jones - Patate', alignment: 'center' }
              ]
            }
          ]
        ]
      },
      layout: {
        hLineWidth: () => 0.5,
        vLineWidth: () => 0.5,
        hLineColor: () => '#555555',
        vLineColor: () => '#555555'
      }
    });

    // --- ANEXOS ---
    contenido.push({
      text: 'Anexos: Hojas de asistencia de los sectores: Patate Viejo, La Merced y San Javier.',
      style: 'anexosText'
    });

    const docDefinition = {
      pageSize: 'A4',
      pageMargins: [40, 45, 40, 45],
      content: contenido,
      styles: {
        docTitle: {
          fontSize: 14,
          bold: true,
          alignment: 'center',
          margin: [0, 0, 0, 2]
        },
        docSubtitle: {
          fontSize: 13,
          bold: true,
          alignment: 'center',
          margin: [0, 0, 0, 2]
        },
        docType: {
          fontSize: 11,
          bold: true,
          alignment: 'center',
          margin: [0, 0, 0, 10]
        },
        sectionTitle: {
          fontSize: 11,
          bold: true,
          color: '#2B547E',
          margin: [0, 8, 0, 4]
        },
        paragraph: {
          fontSize: 10,
          alignment: 'justify',
          lineHeight: 1.2
        },
        paragraphContent: {
          fontSize: 10,
          margin: [0, 0, 0, 5],
          alignment: 'justify',
          lineHeight: 1.2
        },
        bulletField: {
          fontSize: 10,
          margin: [10, 2, 0, 2]
        },
        anexosText: {
          fontSize: 10,
          bold: true,
          color: '#2B547E',
          margin: [0, 10, 0, 0]
        }
      },
      defaultStyle: {
        fontSize: 10
      }
    };

    // Crear y descargar el PDF usando el resolvedor seguro pdfMakeInstance
    const maker = pdfMakeInstance.createPdf ? pdfMakeInstance : ((pdfMake as any).default || pdfMake);
    maker.createPdf(docDefinition as any).download(`Acta_Asamblea_${evento.fecha}.pdf`);
  }

  /**
   * Generar y descargar el PDF de Convocatoria a una Asamblea o Minga
   */
  generarConvocatoriaPDF(evento: any) {
    const fechaObj = evento.fecha ? new Date(evento.fecha) : new Date();
    const dateParts = typeof evento.fecha === 'string' ? evento.fecha.split('T')[0].split('-') : [];
    const dia = dateParts.length === 3 ? parseInt(dateParts[2], 10) : fechaObj.getDate();
    const mesIdx = dateParts.length === 3 ? parseInt(dateParts[1], 10) - 1 : fechaObj.getMonth();
    const anio = dateParts.length === 3 ? parseInt(dateParts[0], 10) : fechaObj.getFullYear();

    const meses = [
      'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
    ];
    const mesNombre = meses[mesIdx] || '__________';
    const fechaTexto = `${dia} de ${mesNombre} de ${anio}`;
    const subtipo = (evento.subtipo_asamblea || 'ORDINARIA').toUpperCase();

    const docDefinition = {
      pageSize: 'A4',
      pageMargins: [45, 50, 45, 50],
      content: [
        { text: 'JUNTA DE RIEGO LA JONES - PATATE', style: 'docTitle' },
        { text: `CONVOCATORIA OFICIAL A ${evento.tipo || 'EVENTO'}`, style: 'docSubtitle' },
        { text: `Patate, ${fechaTexto}`, style: 'docDate' },
        { text: '\n' },
        {
          text: `Se convoca con carácter de OBLIGATORIO a todos los usuarios y comuneros pertenecientes a la Junta de Riego La Jones - Patate a participar en el siguiente evento programado:\n\n`,
          style: 'paragraph'
        },
        {
          table: {
            widths: [130, '*'],
            body: [
              [{ text: 'Asunto / Título:', bold: true }, { text: evento.titulo || 'Asamblea General' }],
              [{ text: 'Tipo de Evento:', bold: true }, { text: `${evento.tipo || 'ASAMBLEA'} (${subtipo})` }],
              [{ text: 'Fecha de Realización:', bold: true }, { text: fechaTexto }],
              [{ text: 'Hora de Inicio:', bold: true }, { text: `${evento.hora_inicio ? evento.hora_inicio.substring(0, 5) : '09:00'} hs` }],
              [{ text: 'Lugar:', bold: true }, { text: evento.lugar || 'Casa Comunal Junta La Jones' }],
              [{ text: 'Descripción:', bold: true }, { text: evento.descripcion || 'Sin descripción adicional.' }]
            ]
          },
          margin: [0, 5, 0, 15],
          layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
            hLineColor: () => '#555555',
            vLineColor: () => '#555555'
          }
        },
        {
          text: evento.genera_multa_ausencia ? `* IMPORTANTE: La inasistencia no justificada estará sujeta a la sanción/multa establecida de $${evento.valor_multa || '10.00'}.` : 'Asistencia obligatoria para los miembros registrados.',
          style: 'warningText'
        },
        { text: '\n\nAtentamente,\n\n\n' },
        {
          columns: [
            {
              stack: [
                { text: '__________________________________', alignment: 'center' },
                { text: 'PRESIDENTE DE LA JUNTA', bold: true, alignment: 'center' },
                { text: 'Junta de Riego La Jones - Patate', alignment: 'center', fontSize: 9 }
              ]
            },
            {
              stack: [
                { text: '__________________________________', alignment: 'center' },
                { text: 'SECRETARIO/A', bold: true, alignment: 'center' },
                { text: 'Junta de Riego La Jones - Patate', alignment: 'center', fontSize: 9 }
              ]
            }
          ]
        }
      ],
      styles: {
        docTitle: { fontSize: 14, bold: true, alignment: 'center', margin: [0, 0, 0, 2] },
        docSubtitle: { fontSize: 12, bold: true, alignment: 'center', color: '#1E3A8A', margin: [0, 0, 0, 5] },
        docDate: { fontSize: 10, alignment: 'right', italic: true, margin: [0, 0, 0, 10] },
        paragraph: { fontSize: 10, alignment: 'justify', lineHeight: 1.2 },
        warningText: { fontSize: 9, bold: true, color: '#DC2626', margin: [0, 5, 0, 15] }
      }
    };

    const maker = pdfMakeInstance.createPdf ? pdfMakeInstance : ((pdfMake as any).default || pdfMake);
    maker.createPdf(docDefinition as any).download(`Convocatoria_${evento.tipo}_${evento.fecha}.pdf`);
  }
}


