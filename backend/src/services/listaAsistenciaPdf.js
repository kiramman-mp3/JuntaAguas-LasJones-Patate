/** Hoja de asistencia en PDF (A4) con el padrón de un evento, para recoger firmas. */
const PDFDocument = require('pdfkit');

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
  if (evento.genera_multa_ausencia) doc.text(`Multa por inasistencia: $${Number(evento.valor_multa).toFixed(2)}`);
  doc.moveDown(0.8);

  const encabezado = (y) => {
    doc.rect(40, y, 515, 20).fill('#e2e8f0');
    doc.fillColor('#0f172a').fontSize(9);
    doc.text('Nº', 45, y + 5, { width: 30 });
    doc.text('Cédula', 80, y + 5, { width: 80 });
    doc.text('Apellidos y Nombres (Comunero)', 165, y + 5, { width: 220 });
    doc.text('Firma / Huella', 390, y + 5, { width: 150 });
    return y + 22;
  };

  let y = encabezado(doc.y);
  personas.forEach((p, i) => {
    if (y > 750) {
      doc.addPage();
      y = encabezado(40);
    }
    doc.fillColor('#333333').fontSize(9);
    doc.text(String(i + 1), 45, y + 4, { width: 30 });
    doc.text(p.cedula, 80, y + 4, { width: 80 });
    doc.text(p.nombre, 165, y + 4, { width: 220 });
    doc.moveTo(390, y + 16).lineTo(540, y + 16).stroke('#cbd5e1');
    doc.moveTo(40, y + 20).lineTo(555, y + 20).stroke('#f1f5f9');
    y += 22;
  });
  doc.end();
}

module.exports = { escribirListaAsistencia };
