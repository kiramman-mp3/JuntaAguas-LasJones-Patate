/**
 * Convocatorias de asambleas y mingas publicadas en el grupo de WhatsApp de la Junta:
 * un solo mensaje al grupo elegido en el panel, en lugar de uno por comunero.
 */
const db = require('../config/db');
const whatsapp = require('./whatsappClient');
const { grupoConvocatorias } = require('./configuracionService');
const { conflict, notFound } = require('../shared/errors');
const { hoy, fechaLarga } = require('../shared/dates');

const ESTADOS_CONVOCABLES = ['BORRADOR', 'PROGRAMADO', 'CONVOCADO'];
const LUGAR_POR_DEFECTO = 'Casa Comunal Junta La Jones';
const MAX_TEXTO = 4000;
const MAX_PUNTO = 300;

const hora = (valor) => String(valor).slice(0, 5);
const recortar = (texto, max) => (texto.length > max ? `${texto.slice(0, max - 1)}…` : texto);

/** Texto del mensaje de convocatoria (formato de WhatsApp: *negrita*). */
function textoConvocatoria(evento, puntos = []) {
  const esMinga = evento.tipo === 'MINGA';
  const horario = evento.hora_fin ? `${hora(evento.hora_inicio)} a ${hora(evento.hora_fin)}` : hora(evento.hora_inicio);
  const lineas = [
    esMinga ? '📢 *CONVOCATORIA A MINGA COMUNITARIA*' : '📢 *CONVOCATORIA A ASAMBLEA GENERAL*',
    'Junta de Agua y Riego La Jones',
    '',
    esMinga ? `📌 *Trabajo:* ${evento.titulo}` : `Se convoca a todos los comuneros a la asamblea: *${evento.titulo}*`,
    `📅 *Fecha:* ${fechaLarga(evento.fecha)}`,
    `⏰ *Hora:* ${horario}`,
    `📍 *Lugar:* ${evento.lugar || LUGAR_POR_DEFECTO}`
  ];

  if (puntos.length) {
    lineas.push('', '*Orden del día:*', ...puntos.map((p, i) => `${i + 1}. ${recortar(p.punto_tratar.trim(), MAX_PUNTO)}`));
  }
  if (evento.descripcion) lineas.push('', `📝 ${evento.descripcion.trim()}`);

  lineas.push('');
  if (evento.genera_multa_ausencia && Number(evento.valor_multa) > 0) {
    lineas.push(`⚠️ La asistencia es obligatoria. La inasistencia genera una multa de $${Number(evento.valor_multa).toFixed(2)}.`);
  } else {
    lineas.push('Se solicita su puntual asistencia.');
  }
  lineas.push(esMinga ? 'Traer sus herramientas de trabajo.' : 'Agradecemos su puntual y comprometida asistencia.');

  return recortar(lineas.join('\n'), MAX_TEXTO);
}

async function ultimoEnvioAlGrupo(eventoId) {
  const [filas] = await db.query(
    `SELECT fecha_envio, destino_nombre FROM envios_convocatoria
     WHERE evento_id = ? AND canal = 'WHATSAPP' AND persona_id IS NULL AND estado = 'ENVIADO'
     ORDER BY fecha_envio DESC LIMIT 1`,
    [eventoId]
  );
  return filas[0] ?? null;
}

async function registrarEnvio({ eventoId, grupo, cuentaId, error = null }) {
  await db.query(
    `INSERT INTO envios_convocatoria (evento_id, persona_id, canal, destino, destino_nombre, estado, fecha_envio, detalle_error, enviado_por_cuenta_id)
     VALUES (?, NULL, 'WHATSAPP', ?, ?, ?, ?, ?, ?)`,
    [eventoId, grupo.id, grupo.nombre, error ? 'ERROR' : 'ENVIADO', error ? null : new Date(), error, cuentaId]
  );
}

/**
 * Publica la convocatoria en el grupo de WhatsApp. Un evento ya convocado por este medio solo
 * se reenvía si se pide expresamente (`reenviar`). Tras enviarla, el evento pasa a CONVOCADO.
 * @returns {Promise<{ grupo: { id: string, nombre: string }, estado: string, reenvio: boolean }>}
 */
async function convocarPorWhatsApp({ eventoId, reenviar = false, cuentaId }) {
  const grupo = await grupoConvocatorias();
  if (!grupo) {
    throw conflict('Elija primero el grupo de WhatsApp de las convocatorias en el panel de WhatsApp.', { codigo: 'GRUPO_NO_CONFIGURADO' });
  }

  const [eventos] = await db.query('SELECT * FROM eventos WHERE id = ?', [eventoId]);
  const evento = eventos[0];
  if (!evento) throw notFound('Evento no encontrado.');
  const nombre = evento.tipo === 'MINGA' ? 'minga' : 'asamblea';
  if (!ESTADOS_CONVOCABLES.includes(evento.estado)) {
    throw conflict(`La ${nombre} está ${evento.estado === 'REALIZADO' ? 'realizada' : 'cancelada'}; no se puede convocar.`);
  }
  if (evento.fecha < hoy()) throw conflict(`La fecha de la ${nombre} ya pasó; no se puede convocar.`);

  const previo = await ultimoEnvioAlGrupo(eventoId);
  if (previo && !reenviar) {
    throw conflict(`Esta convocatoria ya se publicó en el grupo "${previo.destino_nombre}".`, {
      codigo: 'CONVOCATORIA_YA_ENVIADA',
      enviadaEn: previo.fecha_envio
    });
  }

  const [puntos] = evento.tipo === 'ASAMBLEA'
    ? await db.query('SELECT punto_tratar FROM puntos_asamblea WHERE evento_id = ? ORDER BY orden', [eventoId])
    : [[]];

  try {
    await whatsapp.enviarAGrupo(grupo.id, textoConvocatoria(evento, puntos));
  } catch (error) {
    await registrarEnvio({ eventoId, grupo, cuentaId, error: error.message });
    throw error;
  }
  await registrarEnvio({ eventoId, grupo, cuentaId });

  let estado = evento.estado;
  if (estado !== 'CONVOCADO') {
    await db.query("UPDATE eventos SET estado = 'CONVOCADO' WHERE id = ? AND estado IN ('BORRADOR', 'PROGRAMADO')", [eventoId]);
    estado = 'CONVOCADO';
  }
  return { grupo, estado, estadoAnterior: evento.estado, reenvio: Boolean(previo) };
}

module.exports = { textoConvocatoria, convocarPorWhatsApp };
