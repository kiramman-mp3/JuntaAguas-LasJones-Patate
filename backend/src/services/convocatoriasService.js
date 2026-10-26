/**
 * Convocatorias de asambleas y mingas publicadas en el grupo de WhatsApp de la Junta:
 * un solo mensaje al grupo elegido en el panel, en lugar de uno por usuario.
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
    esMinga ? `📌 *Trabajo:* ${evento.titulo}` : `Se convoca a todos los usuarios a la asamblea: *${evento.titulo}*`,
    `📅 *Fecha:* ${fechaLarga(evento.fecha)}`,
    `⏰ *Hora:* ${horario}`,
    `📍 *Lugar:* ${evento.lugar || LUGAR_POR_DEFECTO}`
  ];

  if (esMinga) {
    lineas.push(`🌱 *Sector:* ${evento.sector_nombre || 'Todos los sectores'}`);
  }

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

async function registrarEnvio({ eventoId, grupo, cuentaId, error = null }) {
  await db.query(
    `INSERT INTO envios_convocatoria (evento_id, persona_id, canal, destino, destino_nombre, estado, fecha_envio, detalle_error, enviado_por_cuenta_id)
     VALUES (?, NULL, 'WHATSAPP', ?, ?, ?, ?, ?, ?)`,
    [eventoId, grupo.id, grupo.nombre, error ? 'ERROR' : 'ENVIADO', error ? null : new Date(), error, cuentaId]
  );
}

/**
 * Reserva la convocatoria del evento con un UPDATE condicional: solo una petición puede conseguirla,
 * aunque lleguen varias a la vez. Devuelve false si ya estaba publicada o en curso.
 */
async function reservarConvocatoria(eventoId) {
  const [r] = await db.query(
    'UPDATE eventos SET convocatoria_whatsapp_en = UTC_TIMESTAMP() WHERE id = ? AND convocatoria_whatsapp_en IS NULL',
    [eventoId]
  );
  return r.affectedRows === 1;
}

async function liberarConvocatoria(eventoId) {
  await db.query('UPDATE eventos SET convocatoria_whatsapp_en = NULL WHERE id = ?', [eventoId]);
}

/**
 * Publica la convocatoria en el grupo de WhatsApp una sola vez: un evento ya convocado por este
 * medio (o con un envío en curso) responde 409. Si WhatsApp falla, la reserva se libera para poder
 * intentarlo de nuevo. Tras enviarla, el evento pasa a CONVOCADO.
 * @returns {Promise<{ grupo: { id: string, nombre: string }, estado: string, estadoAnterior: string }>}
 */
async function convocarPorWhatsApp({ eventoId, cuentaId }) {
  const grupo = await grupoConvocatorias();
  if (!grupo) {
    throw conflict('Elija primero el grupo de WhatsApp de las convocatorias en el panel de WhatsApp.', { codigo: 'GRUPO_NO_CONFIGURADO' });
  }

  const [eventos] = await db.query(
    `SELECT e.*, s.nombre AS sector_nombre
     FROM eventos e
     LEFT JOIN sectores s ON s.id = e.sector_id
     WHERE e.id = ?`,
    [eventoId]
  );
  const evento = eventos[0];
  if (!evento) throw notFound('Evento no encontrado.');
  const nombre = evento.tipo === 'MINGA' ? 'minga' : 'asamblea';
  if (!ESTADOS_CONVOCABLES.includes(evento.estado)) {
    throw conflict(`La ${nombre} está ${evento.estado === 'REALIZADO' ? 'realizada' : 'cancelada'}; no se puede convocar.`);
  }
  if (evento.fecha < hoy()) throw conflict(`La fecha de la ${nombre} ya pasó; no se puede convocar.`);

  if (!(await reservarConvocatoria(eventoId))) {
    const [[{ enviadaEn }]] = await db.query('SELECT convocatoria_whatsapp_en AS enviadaEn FROM eventos WHERE id = ?', [eventoId]);
    throw conflict(`La convocatoria de esta ${nombre} ya se publicó en WhatsApp; no se envía dos veces.`, {
      codigo: 'CONVOCATORIA_YA_ENVIADA',
      enviadaEn
    });
  }

  try {
    const [puntos] = evento.tipo === 'ASAMBLEA'
      ? await db.query('SELECT punto_tratar FROM puntos_asamblea WHERE evento_id = ? ORDER BY orden', [eventoId])
      : [[]];
    await whatsapp.enviarAGrupo(grupo.id, textoConvocatoria(evento, puntos));
  } catch (error) {
    await liberarConvocatoria(eventoId);
    await registrarEnvio({ eventoId, grupo, cuentaId, error: error.message });
    throw error;
  }
  await registrarEnvio({ eventoId, grupo, cuentaId });

  let estado = evento.estado;
  if (estado !== 'CONVOCADO') {
    await db.query("UPDATE eventos SET estado = 'CONVOCADO' WHERE id = ? AND estado IN ('BORRADOR', 'PROGRAMADO')", [eventoId]);
    estado = 'CONVOCADO';
  }
  return { grupo, estado, estadoAnterior: evento.estado };
}

module.exports = { textoConvocatoria, convocarPorWhatsApp };
