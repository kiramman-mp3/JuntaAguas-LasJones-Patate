import { Injectable, inject } from '@angular/core';
import type { jsPDF } from 'jspdf';
import { NotificationService } from './notification.service';
import { diaEnEcuador } from '../utils/fechas';
import { CARGADOR_JSPDF } from '../utils/jspdf';

/** Datos del evento que usan el acta y la convocatoria. Los campos opcionales se completan a mano al imprimir. */
export interface EventoDocumento {
  id?: number;
  tipo?: string;
  titulo?: string;
  descripcion?: string | null;
  fecha?: string;
  hora_inicio?: string | null;
  hora_fin?: string | null;
  hora_clausura?: string | null;
  lugar?: string | null;
  sector?: string | null;
  subtipo_asamblea?: string | null;
  numero_acta?: string | null;
  presidente?: string | null;
  secretario?: string | null;
  usuarios_presentes?: number | string | null;
  total_usuarios?: number | string | null;
  cuorum_requerido?: string | null;
  cuorum_constatado?: string | null;
  resolucion_acta_anterior?: string | null;
  varios_desarrollo?: string | null;
  varios_resolucion?: string | null;
  genera_multa_ausencia?: boolean | number | null;
  valor_multa?: number | string | null;
}

/** Punto del orden del día con lo tratado y resuelto. */
export interface PuntoActa {
  orden?: number;
  punto_tratar?: string | null;
  tratado?: string | null;
  desarrollo?: string | null;
  resolucion?: string | null;
}

export interface AsistenciaResumen {
  estado?: string;
  total: number | string;
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const LINEA = '____________________________________________________________________________';
const AZUL: [number, number, number] = [43, 84, 126];
const ROJO: [number, number, number] = [220, 38, 38];

/** Día, mes (en letras) y año del evento según el calendario de Ecuador. */
function fechaDelEvento(evento: EventoDocumento) {
  const [anio, mes, dia] = diaEnEcuador(evento.fecha || new Date()).split('-').map(Number);
  const mesNombre = MESES[mes - 1] ?? '__________';
  return { anio, dia, mesNombre, texto: `${dia} de ${mesNombre} de ${anio}` };
}

const hora = (valor: string | null | undefined, porDefecto: string) => (valor ? valor.substring(0, 5) : porDefecto);

/**
 * Escribe un documento A4 de arriba hacia abajo con salto de página automático.
 * Reúne lo que necesitan el acta y la convocatoria: títulos, párrafos justificados, tablas y firmas.
 */
class Redactor {
  private y: number;
  private readonly ancho: number;
  private readonly alto: number;

  constructor(
    readonly doc: jsPDF,
    private readonly autoTable: (doc: jsPDF, opciones: object) => void,
    private readonly margen: number
  ) {
    this.y = margen;
    this.ancho = doc.internal.pageSize.getWidth() - margen * 2;
    this.alto = doc.internal.pageSize.getHeight();
  }

  private asegurar(espacio: number): void {
    if (this.y + espacio > this.alto - this.margen) {
      this.doc.addPage();
      this.y = this.margen;
    }
  }

  espacio(puntos: number): void {
    this.y += puntos;
  }

  centrado(texto: string, tamano: number, { color = [0, 0, 0] as [number, number, number], separacion = 4 } = {}): void {
    this.asegurar(tamano);
    this.doc.setFont('helvetica', 'bold').setFontSize(tamano).setTextColor(...color);
    this.y += tamano;
    this.doc.text(texto, this.margen + this.ancho / 2, this.y, { align: 'center' });
    this.y += separacion;
    this.doc.setTextColor(0, 0, 0);
  }

  derecha(texto: string, tamano: number): void {
    this.doc.setFont('helvetica', 'italic').setFontSize(tamano);
    this.y += tamano;
    this.doc.text(texto, this.margen + this.ancho, this.y, { align: 'right' });
    this.y += 6;
  }

  seccion(texto: string): void {
    this.asegurar(30);
    this.y += 8;
    this.doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(...AZUL);
    this.y += 11;
    this.doc.text(texto, this.margen, this.y);
    this.doc.setTextColor(0, 0, 0);
    this.y += 5;
  }

  parrafo(texto: string, { negrita = false, sangria = 0, tamano = 10, color = [0, 0, 0] as [number, number, number] } = {}): void {
    this.doc.setFont('helvetica', negrita ? 'bold' : 'normal').setFontSize(tamano).setTextColor(...color);
    const lineas: string[] = this.doc.splitTextToSize(texto, this.ancho - sangria);
    const altoLinea = tamano * 1.2;
    for (const linea of lineas) {
      this.asegurar(altoLinea);
      this.y += altoLinea;
      this.doc.text(linea, this.margen + sangria, this.y);
    }
    this.y += 4;
    this.doc.setTextColor(0, 0, 0);
  }

  tabla(filas: [string, string][], anchoEtiqueta = 130): void {
    this.autoTable(this.doc, {
      startY: this.y + 4,
      body: filas,
      theme: 'grid',
      margin: { left: this.margen, right: this.margen },
      styles: { fontSize: 10, textColor: [0, 0, 0], lineColor: [85, 85, 85], lineWidth: 0.5 },
      columnStyles: { 0: { cellWidth: anchoEtiqueta, fontStyle: 'bold' } }
    });
    this.y = ((this.doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? this.y) + 12;
  }

  /** Dos bloques de firma lado a lado: línea, nombre y cargos. */
  firmas(bloques: string[][]): void {
    this.asegurar(90);
    this.y += 40;
    const columna = this.ancho / bloques.length;
    bloques.forEach((lineas, i) => {
      const x = this.margen + columna * i + columna / 2;
      let y = this.y;
      this.doc.setFont('helvetica', 'normal').setFontSize(10).text('__________________________________', x, y, { align: 'center' });
      lineas.forEach((texto, j) => {
        y += 12;
        this.doc.setFont('helvetica', j < 2 ? 'bold' : 'normal').setFontSize(j < 2 ? 10 : 9).text(texto, x, y, { align: 'center' });
      });
    });
    this.y += 12 * (Math.max(...bloques.map((b) => b.length)) + 1);
  }
}

/** Genera el acta y la convocatoria de los eventos en PDF con jsPDF (la misma librería de los comprobantes). */
@Injectable({
  providedIn: 'root'
})
export class ActasService {
  private readonly notify = inject(NotificationService);
  private readonly cargarJsPdf = inject(CARGADOR_JSPDF);

  /** Crea el documento con `escribir`, lo descarga e informa si no se pudo cargar el generador de PDF. */
  private async generar(nombre: string, margen: number, escribir: (r: Redactor) => void): Promise<void> {
    try {
      const { jsPDF, autoTable } = await this.cargarJsPdf();
      const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      escribir(new Redactor(doc, autoTable as unknown as (doc: jsPDF, opciones: object) => void, margen));
      doc.save(nombre);
    } catch (error) {
      console.error('No se pudo generar el PDF:', error);
      this.notify.error('No se pudo generar el PDF. Verifique su conexión e intente de nuevo.');
    }
  }

  /**
   * Genera y descarga el acta oficial de una asamblea.
   * @param evento detalle del evento (título, fecha, lugar, presidente, secretario…)
   * @param puntos puntos del orden del día con lo tratado y resuelto
   * @param asistenciaStats resumen de asistencia por estado (opcional)
   */
  generarActaPDF(evento: EventoDocumento, puntos: PuntoActa[] = [], asistenciaStats?: AsistenciaResumen[]): Promise<void> {
    const { anio, dia, mesNombre, texto: fechaTexto } = fechaDelEvento(evento);
    const horaInicio = hora(evento.hora_inicio, '________');
    const horaClausura = evento.hora_fin ? evento.hora_fin.substring(0, 5) : (evento.hora_clausura || '________');
    const extraordinaria = (evento.subtipo_asamblea || 'ORDINARIA').toUpperCase() === 'EXTRAORDINARIA';

    let presentes: number | string = evento.usuarios_presentes || '______';
    let totalUsuarios: number | string = evento.total_usuarios || '______';
    if (asistenciaStats?.length) {
      const presentesFila = asistenciaStats.find((s) => (s.estado || '').toUpperCase() === 'PRESENTE');
      if (presentesFila) presentes = presentesFila.total;
      const suma = asistenciaStats.reduce((acc, s) => acc + (Number.parseInt(String(s.total), 10) || 0), 0);
      if (suma > 0) totalUsuarios = suma;
    }

    const presidente = evento.presidente || '____________________________________________';
    const secretario = evento.secretario || '____________________________________________';
    const lugar = evento.lugar || 'sede de la organización';
    const sector = evento.sector || 'Patate Centro';
    const textoDe = (p: PuntoActa | undefined) => (p?.punto_tratar || '').toLowerCase();

    return this.generar(`Acta_Asamblea_${evento.fecha}.pdf`, 40, (r) => {
      r.centrado('JUNTA DE RIEGO LA JONES - PATATE', 14, { separacion: 2 });
      r.centrado('ACTA DE ASAMBLEA GENERAL', 13, { separacion: 2 });
      r.centrado(extraordinaria ? 'EXTRAORDINARIA' : 'ORDINARIA', 11, { separacion: 4 });
      r.tabla([
        ['Acta N.º', evento.numero_acta || `N.º ${evento.id ?? '___'}`],
        ['Fecha', fechaTexto],
        ['Hora de inicio', `${horaInicio} hs`]
      ]);

      r.parrafo(`En la sede de la organización ubicada en ${lugar}, sector ${sector}, cantón Patate, provincia de Tungurahua, a los ${dia} días del mes de ${mesNombre} del año ${anio}, siendo las ${horaInicio} horas, se reúnen los usuarios de la Junta de Riego La Jones - Patate, previa convocatoria realizada de conformidad con las disposiciones correspondientes, con el objeto de celebrar la Asamblea General ${extraordinaria ? 'Extraordinaria' : 'Ordinaria'}.`);

      r.seccion('INSTALACIÓN DE LA ASAMBLEA');
      r.parrafo(`Preside la Asamblea el señor ${presidente}, Presidente de la Junta de Riego La Jones - Patate, y actúa como Secretario/a el/la señor/a ${secretario}.`);
      r.parrafo('El señor Presidente da la bienvenida a los usuarios presentes.');

      r.seccion('Punto 1. CONSTATACIÓN DEL CUÓRUM');
      r.parrafo(`El/la Secretario/a procede a constatar la asistencia de los usuarios convocados, mediante las firmas constantes en las hojas de asistencia, verificándose la presencia de ${presentes} usuarios de un total de ${totalUsuarios} usuarios registrados.`);
      r.parrafo(`Usuarios presentes: ${presentes}`, { sangria: 10 });
      r.parrafo(`Cuórum requerido: ${evento.cuorum_requerido || '50% + 1 de los usuarios registrados'}`, { sangria: 10 });
      r.parrafo(`Cuórum constatado: ${evento.cuorum_constatado || (presentes !== '______' ? 'Existe cuórum reglamentario' : '______________________________')}`, { sangria: 10 });
      r.parrafo('Una vez cumplidos los requisitos correspondientes, se declara instalada la Asamblea.');

      r.seccion('Punto 2. LECTURA Y APROBACIÓN DEL ACTA ANTERIOR');
      r.parrafo('El/la Secretario/a procede a dar lectura al acta de la Asamblea General anterior. Una vez concluida la lectura, el señor Presidente pone el acta a consideración de los usuarios presentes.');
      const punto2 = puntos.find((p) => p.orden === 2 || textoDe(p).includes('acta anterior'));
      r.parrafo('Resolución:', { negrita: true });
      r.parrafo(punto2?.resolucion || evento.resolucion_acta_anterior || 'El acta de la asamblea anterior es aprobada sin observaciones por la unanimidad de los usuarios presentes.');

      const dinamicos = puntos.filter((p) => !['cuórum', 'cuorum', 'acta anterior', 'varios'].some((clave) => textoDe(p).includes(clave)));
      let numero = 3;
      for (const p of dinamicos) {
        r.seccion(`PUNTO ${numero}. ${(p.punto_tratar || '').toUpperCase()}`);
        r.parrafo('Desarrollo:', { negrita: true });
        r.parrafo(p.tratado || p.desarrollo || LINEA);
        r.parrafo('Resolución / Resoluciones:', { negrita: true });
        r.parrafo(p.resolucion || LINEA);
        numero++;
      }

      const varios = puntos.find((p) => textoDe(p).includes('varios'));
      r.seccion(`PUNTO ${numero}. VARIOS`);
      r.parrafo('Durante este punto, los usuarios presentan los siguientes asuntos:');
      r.parrafo(varios?.tratado || evento.varios_desarrollo || LINEA);
      r.parrafo('Resoluciones / Acuerdos:', { negrita: true });
      r.parrafo(varios?.resolucion || evento.varios_resolucion || LINEA);

      r.seccion('CLAUSURA');
      r.parrafo(`Una vez tratados todos los puntos constantes en el orden del día, y no habiendo más asuntos que tratar, el señor Presidente agradece la presencia y participación de los usuarios y declara clausurada la Asamblea General a las ${horaClausura} horas del día ${fechaTexto}.`);
      r.parrafo('Para constancia de lo actuado, se suscribe la presente acta.');

      r.firmas([
        [`Sr. ${presidente}`, 'PRESIDENTE', 'Junta de Riego La Jones - Patate'],
        [`Sr./Sra. ${secretario}`, 'SECRETARIO/A', 'Junta de Riego La Jones - Patate']
      ]);
      r.parrafo('Anexos: Hojas de asistencia de los sectores.', { negrita: true, color: AZUL });
    });
  }

  /** Genera y descarga la convocatoria oficial a una asamblea o minga. */
  generarConvocatoriaPDF(evento: EventoDocumento): Promise<void> {
    const { texto: fechaTexto } = fechaDelEvento(evento);
    const subtipo = (evento.subtipo_asamblea || 'ORDINARIA').toUpperCase();
    const multa = evento.genera_multa_ausencia
      ? `* IMPORTANTE: La inasistencia no justificada estará sujeta a la sanción/multa establecida de $${Number(evento.valor_multa || 10).toFixed(2)}.`
      : 'Asistencia obligatoria para los miembros registrados.';

    return this.generar(`Convocatoria_${evento.tipo}_${evento.fecha}.pdf`, 45, (r) => {
      r.centrado('JUNTA DE RIEGO LA JONES - PATATE', 14, { separacion: 2 });
      r.centrado(`CONVOCATORIA OFICIAL A ${evento.tipo || 'EVENTO'}`, 12, { color: [30, 58, 138], separacion: 4 });
      r.derecha(`Patate, ${fechaTexto}`, 10);
      r.espacio(10);
      r.parrafo('Se convoca con carácter de OBLIGATORIO a todos los usuarios pertenecientes a la Junta de Riego La Jones - Patate a participar en el siguiente evento programado:');
      r.tabla([
        ['Asunto / Título:', evento.titulo || 'Asamblea General'],
        ['Tipo de Evento:', `${evento.tipo || 'ASAMBLEA'} (${subtipo})`],
        ['Fecha de Realización:', fechaTexto],
        ['Hora de Inicio:', `${hora(evento.hora_inicio, '09:00')} hs`],
        ['Lugar:', evento.lugar || 'Casa Comunal Junta La Jones'],
        ['Descripción:', evento.descripcion || 'Sin descripción adicional.']
      ]);
      r.parrafo(multa, { negrita: true, tamano: 9, color: evento.genera_multa_ausencia ? ROJO : [0, 0, 0] });
      r.espacio(14);
      r.parrafo('Atentamente,');
      r.firmas([
        ['PRESIDENTE DE LA JUNTA', '', 'Junta de Riego La Jones - Patate'],
        ['SECRETARIO/A', '', 'Junta de Riego La Jones - Patate']
      ]);
    });
  }
}
