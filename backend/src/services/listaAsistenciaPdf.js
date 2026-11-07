/** Hoja de asistencia en PDF (A4) con el padrón de un evento, separado por sectores, para recoger firmas. */
const PDFDocument = require('pdfkit');

const ANCHO_NOMBRE = 220;
// Alto holgado para que cada usuario pueda firmar o poner su huella en su renglón.
const ALTO_FILA_MINIMO = 40;
const LIMITE_PAGINA = 780;

const SIN_SECTOR = 'Sin sector asignado';

/**
 * Separa el padrón por sector: cada persona firma una sola vez, en el sector donde tiene más lotes.
 * Un evento de un solo sector es un único grupo; sin lotes, las personas van al final.
 */
const agruparPorSector = (evento, personas) => {
  if (evento.sector_nombre) return [{ nombre: evento.sector_nombre, personas }];
  const porSector = new Map();
  for (const p of personas) {
    const nombre = p.sector_nombre || null;
    if (!porSector.has(nombre)) porSector.set(nombre, []);
    porSector.get(nombre).push(p);
  }
  const grupos = [...porSector].map(([nombre, lista]) => ({ nombre, personas: lista }));
  grupos.sort((a, b) => {
    if (a.nombre === null || b.nombre === null) return (a.nombre === null) - (b.nombre === null);
    return a.nombre.localeCompare(b.nombre, 'es');
  });
  return grupos.length ? grupos : [{ nombre: null, personas: [] }];
};

const fechaLegible = (iso) => {
  const [a, m, d] = String(iso).slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
};

/**
 * Escribe la hoja de asistencia en `destino` (por ejemplo, la respuesta HTTP) y la cierra.
 * @param {import('stream').Writable} destino
 * @param {object} evento fila de eventos
 * @param {{ cedula: string, nombre: string }[]} personas padrón ordenado
 */
function escribirListaAsistencia(destino, evento, personas) {
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  doc.pipe(destino);

  doc.fillColor('#0284c7').fontSize(16).text('JUNTA DE AGUA Y RIEGO LA JONES (PATATE)', { align: 'center' });
  doc.fillColor('#333333').fontSize(12).text(`HOJA DE ASISTENCIA PARA REGISTRO Y FIRMAS - ${evento.tipo}`, { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(10).fillColor('#000000');
  doc.text(`Evento: ${evento.titulo}`);
  doc.text(`Fecha: ${fechaLegible(evento.fecha)} | Hora: ${String(evento.hora_inicio || '08:00').slice(0, 5)}`);
  doc.text(`Lugar: ${evento.lugar || 'Casa Comunal Junta La Jones'}`);
  if (evento.tipo === 'MINGA' || evento.sector_nombre) {
    doc.text(`Sector: ${evento.sector_nombre || 'Todos los sectores'}`);
  }
  if (evento.genera_multa_ausencia) doc.text(`Multa por inasistencia: $${Number(evento.valor_multa).toFixed(2)}`);
  doc.moveDown(0.8);

  const encabezado = (y) => {
    doc.rect(40, y, 515, 20).fill('#e2e8f0');
    doc.fillColor('#0f172a').fontSize(9);
    doc.text('Nº', 45, y + 5, { width: 30 });
    doc.text('Cédula', 80, y + 5, { width: 80 });
    doc.text('Apellidos y Nombres (Usuario)', 165, y + 5, { width: 220 });
    doc.text('Firma / Huella', 390, y + 5, { width: 150 });
    return y + 22;
  };

  // Con varios sectores (o uno con nombre) cada hoja lleva su banda de sector, que se repite al saltar de página.
  const banda = (y, grupo, mostrar) => {
    if (!mostrar) return y;
    doc.rect(40, y, 515, 18).fill('#0284c7');
    doc.fillColor('#ffffff').fontSize(10);
    doc.text(`Sector: ${grupo.nombre || SIN_SECTOR} - ${grupo.personas.length} usuarios`, 45, y + 4, { width: 505 });
    return y + 22;
  };

  const grupos = agruparPorSector(evento, personas);
  grupos.forEach((grupo, g) => {
    const mostrarBanda = grupos.length > 1 || !!grupo.nombre;
    // Cada sector empieza en su propia página para poder repartirla y recogerla por separado.
    if (g > 0) doc.addPage();
    let y = encabezado(banda(g === 0 ? doc.y : 40, grupo, mostrarBanda));
    grupo.personas.forEach((p, i) => {
      // Un nombre largo ocupa varios renglones: la fila crece lo que mida el texto para no pisar la siguiente.
      doc.fillColor('#333333').fontSize(9);
      const alto = Math.max(ALTO_FILA_MINIMO, doc.heightOfString(p.nombre, { width: ANCHO_NOMBRE }) + 8);
      if (y + alto > LIMITE_PAGINA) {
        doc.addPage();
        y = encabezado(banda(40, grupo, mostrarBanda));
        doc.fillColor('#333333').fontSize(9);
      }
      doc.text(String(i + 1), 45, y + 4, { width: 30 });
      doc.text(p.cedula, 80, y + 4, { width: 80 });
      doc.text(p.nombre, 165, y + 4, { width: ANCHO_NOMBRE });
      doc.moveTo(390, y + alto - 6).lineTo(540, y + alto - 6).stroke('#cbd5e1');
      doc.moveTo(40, y + alto - 2).lineTo(555, y + alto - 2).stroke('#f1f5f9');
      y += alto;
    });
  });
  doc.end();
}

module.exports = { escribirListaAsistencia };
