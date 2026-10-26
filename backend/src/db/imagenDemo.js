const zlib = require('zlib');

/** Chunk PNG: longitud + tipo + datos + CRC. */
function chunk(tipo, datos) {
  const cabecera = Buffer.alloc(8);
  cabecera.writeUInt32BE(datos.length, 0);
  cabecera.write(tipo, 4, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(Buffer.concat([cabecera.subarray(4), datos])), 0);
  return Buffer.concat([cabecera, datos, crc]);
}

/**
 * PNG de datos de demostración: un degradado vertical entre dos colores [r, g, b].
 * Solo lo usa el seed para que las noticias de ejemplo tengan imagen sin depender de archivos externos.
 */
function degradadoPng(arriba, abajo, ancho = 960, alto = 540) {
  const filas = Buffer.alloc((ancho * 3 + 1) * alto);
  for (let y = 0; y < alto; y += 1) {
    const t = y / (alto - 1);
    const color = arriba.map((c, i) => Math.round(c + (abajo[i] - c) * t));
    const inicio = y * (ancho * 3 + 1);
    filas[inicio] = 0; // filtro "ninguno"
    for (let x = 0; x < ancho; x += 1) filas.set(color, inicio + 1 + x * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(ancho, 0);
  ihdr.writeUInt32BE(alto, 4);
  ihdr[8] = 8; // 8 bits por canal
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(filas, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

module.exports = { degradadoPng };
