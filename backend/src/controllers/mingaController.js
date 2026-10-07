const { registrarAuditoria } = require('../services/auditService');
const eventos = require('../services/eventosService');
const { withTransaction } = require('../shared/transaction');

/**
 * Endpoints específicos de mingas. Comparten las reglas de asambleas (eventosService)
 * pero rechazan eventos de otro tipo.
 */
async function enMinga(req, operacion) {
  return withTransaction(async (conexion) => {
    const minga = await eventos.obtenerEvento(conexion, req.params.id, { tipo: 'MINGA' });
    return operacion(conexion, minga);
  });
}

async function getAsistencias(req, res) {
  const { personas, resumen, estado } = await enMinga(req, async (conexion, minga) => ({
    ...(await eventos.obtenerPadron(conexion, minga)),
    estado: minga.estado
  }));
  return res.json({ status: 'OK', data: personas, resumen, estado });
}

async function cambiarEstado(req, res) {
  const estado = req.body?.estado;
  const resultado = await enMinga(req, (conexion, minga) => eventos.cambiarEstado(conexion, minga, estado));
  if (resultado.cambiado) {
    await registrarAuditoria({
      cuentaId: req.user.cuentaId, accion: 'MODIFICAR', entidad: 'eventos', entidadId: Number(req.params.id), ip: req.ip,
      detalle: { estadoAnterior: resultado.estadoAnterior, estado }
    });
  }
  return res.json({ status: 'OK', message: resultado.cambiado ? 'Estado de la minga actualizado.' : 'La minga ya tiene ese estado.', estado });
}

async function finalizar(req, res) {
  const resultado = await enMinga(req, (conexion, minga) => eventos.finalizar(conexion, minga));
  if (!resultado.yaFinalizada) {
    await registrarAuditoria({
      cuentaId: req.user.cuentaId, accion: 'MODIFICAR', entidad: 'eventos', entidadId: Number(req.params.id), ip: req.ip,
      detalle: { finalizarMinga: true, multasGeneradas: resultado.multasGeneradas }
    });
  }
  return res.json({
    status: 'OK',
    message: resultado.yaFinalizada
      ? 'La minga ya fue finalizada. No se generaron nuevas multas.'
      : `Minga finalizada. Multas registradas: ${resultado.multasGeneradas}.`,
    estado: 'REALIZADO',
    multasGeneradas: resultado.multasGeneradas,
    yaFinalizada: resultado.yaFinalizada
  });
}

async function registrarAsistencias(req, res) {
  const { registradas } = await enMinga(req, (conexion, minga) =>
    eventos.registrarAsistencias(conexion, minga, req.body?.asistencias, req.user.cuentaId)
  );
  await registrarAuditoria({
    cuentaId: req.user.cuentaId, accion: 'MODIFICAR', entidad: 'asistencias', entidadId: Number(req.params.id), ip: req.ip,
    detalle: { asistenciasMinga: registradas }
  });
  return res.json({ status: 'OK', message: 'Asistencias de la minga guardadas.', registradas });
}

module.exports = { cambiarEstado, finalizar, registrarAsistencias, getAsistencias };
