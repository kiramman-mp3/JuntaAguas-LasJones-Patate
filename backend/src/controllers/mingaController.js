const db = require('../config/db');
const { registrarAuditoria } = require('../services/auditService');

const ESTADOS_ABIERTOS = ['BORRADOR', 'PROGRAMADO', 'CONVOCADO'];
const ESTADOS_ASISTENCIA = ['PENDIENTE', 'PRESENTE', 'AUSENTE', 'JUSTIFICADO'];

function errorHttp(statusCode, message, detalle = {}) {
  return Object.assign(new Error(message), { statusCode, detalle });
}

async function obtenerMinga(connection, id) {
  if (!Number.isSafeInteger(Number(id)) || Number(id) <= 0) {
    throw errorHttp(400, 'El identificador de la minga no es válido.');
  }
  const [eventos] = await connection.query(
    `SELECT e.*, DATE_FORMAT(e.fecha, '%Y-%m-%d') AS fecha_iso,
            (TIMESTAMP(e.fecha, e.hora_inicio) <= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 5 HOUR)) AS iniciada
     FROM eventos e WHERE e.id = ? FOR UPDATE`, [id]
  );
  if (!eventos.length) throw errorHttp(404, 'Minga no encontrada.');
  if (eventos[0].tipo !== 'MINGA') throw errorHttp(400, 'Esta operación corresponde exclusivamente a Mingas.');
  return eventos[0];
}

function exigirAbierta(minga) {
  if (!ESTADOS_ABIERTOS.includes(minga.estado)) {
    throw errorHttp(409, 'La minga ya está realizada o cancelada; su registro de asistencia está cerrado.');
  }
}

async function obtenerPadron(connection, minga) {
  const [personas] = await connection.query(
    `SELECT p.id AS persona_id, CONCAT(p.apellidos, ' ', p.nombres) AS nombre, p.cedula,
       COALESCE(a.estado, 'PENDIENTE') AS estado,
       COALESCE(a.motivo_justificacion, '') AS motivo_justificacion
     FROM personas p LEFT JOIN asistencias a ON a.persona_id = p.id AND a.evento_id = ?
     WHERE p.estado = 'ACTIVO' OR a.id IS NOT NULL ORDER BY p.apellidos, p.nombres FOR UPDATE`, [minga.id]
  );
  const resumen = { total: personas.length, presentes: 0, ausentes: 0, justificados: 0, pendientes: 0 };
  for (const persona of personas) {
    if (persona.estado === 'PRESENTE') resumen.presentes++;
    else if (persona.estado === 'AUSENTE') resumen.ausentes++;
    else if (persona.estado === 'JUSTIFICADO' && persona.motivo_justificacion.trim()) resumen.justificados++;
    else resumen.pendientes++;
  }
  return { personas, resumen };
}

async function getAsistencias(req, res, next) {
  return transaccion(req, res, next, async (connection, minga) => {
    const { personas, resumen } = await obtenerPadron(connection, minga);
    return { data: personas, resumen, estado: minga.estado };
  });
}

// Todas las escrituras de este módulo adquieren primero el mismo bloqueo de evento.
async function transaccion(req, res, next, operacion) {
  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();
    const minga = await obtenerMinga(connection, req.params.id);
    const resultado = await operacion(connection, minga);
    await connection.commit();
    if (resultado.auditoria) {
      await registrarAuditoria({ cuentaId: req.user.cuentaId, accion: 'MODIFICAR', entidad: 'eventos',
        entidadId: minga.id, ip: req.ip, detalle: resultado.auditoria });
    }
    const { auditoria: _auditoria, ...respuesta } = resultado;
    return res.json({ status: 'OK', ...respuesta });
  } catch (error) {
    if (connection) await connection.rollback();
    if (error.statusCode) return res.status(error.statusCode).json({ status: 'ERROR', message: error.message, ...error.detalle });
    next(error);
  } finally {
    if (connection) connection.release();
  }
}

async function cambiarEstado(req, res, next) {
  return transaccion(req, res, next, async (connection, minga) => {
    const estado = req.body.estado;
    if (!['PROGRAMADO', 'CONVOCADO', 'CANCELADO'].includes(estado)) {
      throw errorHttp(400, 'Seleccione Programada, Convocada o Cancelada. Para realizarla, use Finalizar minga.');
    }
    if (minga.estado === estado) return { message: 'La minga ya tiene ese estado.', estado };
    exigirAbierta(minga);
    const permitidos = { BORRADOR: ['PROGRAMADO', 'CONVOCADO', 'CANCELADO'],
      PROGRAMADO: ['CONVOCADO', 'CANCELADO'], CONVOCADO: ['CANCELADO'] };
    if (!permitidos[minga.estado].includes(estado)) throw errorHttp(409, 'No se permite retroceder el estado de la minga.');
    await connection.query('UPDATE eventos SET estado = ? WHERE id = ?', [estado, minga.id]);
    return { message: 'Estado de la minga actualizado.', estado, auditoria: { estadoAnterior: minga.estado, estado } };
  });
}

async function finalizar(req, res, next) {
  return transaccion(req, res, next, async (connection, minga) => {
    if (minga.estado === 'REALIZADO') {
      return { message: 'La minga ya fue finalizada. No se generaron nuevas multas.', estado: 'REALIZADO', multasGeneradas: 0, yaFinalizada: true };
    }
    exigirAbierta(minga);
    if (!Number(minga.iniciada)) throw errorHttp(409, 'Solo se puede finalizar una minga cuya fecha y hora de inicio ya hayan llegado.');
    const { personas, resumen } = await obtenerPadron(connection, minga);
    if (!resumen.total || resumen.pendientes) {
      throw errorHttp(409, 'Complete y guarde la asistencia de todos los comuneros antes de finalizar.', { resumen });
    }
    let multasGeneradas = 0;
    if (minga.genera_multa_ausencia) {
      const valor = Number(minga.valor_multa);
      if (!Number.isFinite(valor) || valor <= 0) throw errorHttp(409, 'Revise el valor de la multa antes de finalizar.');
      const [conceptos] = await connection.query("SELECT id FROM conceptos_cobro WHERE codigo = 'MULTA_MINGA' AND activo = TRUE");
      if (!conceptos.length) throw errorHttp(409, 'El concepto MULTA_MINGA no está configurado o está inactivo.');
      const [registradas] = await connection.query(
        'SELECT persona_id FROM obligaciones WHERE evento_id = ? AND concepto_id = ?', [minga.id, conceptos[0].id]
      );
      const yaMultadas = new Set(registradas.map(o => Number(o.persona_id)));
      const ausentes = personas.filter(p => p.estado === 'AUSENTE');
      for (const ausente of ausentes) {
        if (yaMultadas.has(Number(ausente.persona_id))) continue;
        // El evento identifica la multa. NULL en mes evita que la clave de cuotas
        // mensuales impida registrar dos mingas distintas en el mismo mes.
        await connection.query(
          `INSERT INTO obligaciones (persona_id, concepto_id, evento_id, periodo_anio, periodo_mes,
             fecha_emision, valor, origen, estado, observacion)
           VALUES (?, ?, ?, ?, NULL, DATE(DATE_SUB(UTC_TIMESTAMP(), INTERVAL 5 HOUR)), ?, 'AUTOMATICA', 'PENDIENTE', ?)`,
          [ausente.persona_id, conceptos[0].id, minga.id, Number(minga.fecha_iso.slice(0, 4)),
            minga.valor_multa, `Multa por ausencia a MINGA (${minga.fecha_iso}): ${minga.titulo}`.slice(0, 255)]
        );
        multasGeneradas++;
      }
    }
    await connection.query("UPDATE eventos SET estado = 'REALIZADO' WHERE id = ?", [minga.id]);
    return { message: `Minga finalizada. Multas registradas: ${multasGeneradas}.`, estado: 'REALIZADO', multasGeneradas,
      auditoria: { finalizarMinga: true, multasGeneradas } };
  });
}

async function registrarAsistencias(req, res, next) {
  return transaccion(req, res, next, async (connection, minga) => {
    exigirAbierta(minga);
    const asistencias = req.body.asistencias;
    if (!Array.isArray(asistencias) || !asistencias.length) throw errorHttp(400, 'Se requiere una lista de asistencias.');
    const ids = new Set();
    for (const a of asistencias) {
      const id = Number(a.persona_id);
      if (!Number.isSafeInteger(id) || id <= 0 || ids.has(id) || !ESTADOS_ASISTENCIA.includes(a.estado)) {
        throw errorHttp(400, 'La lista contiene personas repetidas o estados de asistencia inválidos.');
      }
      if (a.estado === 'JUSTIFICADO' && (typeof a.motivo_justificacion !== 'string' || !a.motivo_justificacion.trim())) {
        throw errorHttp(400, 'Se requiere un motivo para cada ausencia justificada.');
      }
      if (a.motivo_justificacion && (typeof a.motivo_justificacion !== 'string' || a.motivo_justificacion.length > 255)) {
        throw errorHttp(400, 'El motivo no puede superar los 255 caracteres.');
      }
      ids.add(id);
    }
    const { personas } = await obtenerPadron(connection, minga);
    const permitidos = new Set(personas.map(p => Number(p.persona_id)));
    if ([...ids].some(id => !permitidos.has(id))) {
      throw errorHttp(400, 'La lista contiene personas que no pertenecen al registro de esta minga.');
    }
    for (const a of asistencias) {
      await connection.query(
        `INSERT INTO asistencias (evento_id, persona_id, estado, hora_registro, motivo_justificacion, registrado_por_cuenta_id)
         VALUES (?, ?, ?, NOW(), ?, ?)
         ON DUPLICATE KEY UPDATE estado = VALUES(estado), hora_registro = NOW(),
           motivo_justificacion = VALUES(motivo_justificacion), registrado_por_cuenta_id = VALUES(registrado_por_cuenta_id)`,
        [minga.id, Number(a.persona_id), a.estado, a.estado === 'JUSTIFICADO' ? a.motivo_justificacion.trim() : null, req.user.cuentaId]
      );
    }
    return { message: 'Asistencias de la minga guardadas.', auditoria: { asistenciasMinga: asistencias.length } };
  });
}

// Mantiene el contrato anterior y deja las Asambleas a su controlador original.
async function encaminarAsistencias(req, res, next) {
  try {
    const [eventos] = await db.query('SELECT tipo FROM eventos WHERE id = ?', [req.params.id]);
    if (eventos[0]?.tipo === 'MINGA') return registrarAsistencias(req, res, next);
    next();
  } catch (error) { next(error); }
}

module.exports = { cambiarEstado, finalizar, registrarAsistencias, encaminarAsistencias, getAsistencias };
