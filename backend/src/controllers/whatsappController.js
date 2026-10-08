/**
 * Panel de WhatsApp: conexión del teléfono de la Junta (delegada al servicio de WhatsApp),
 * grupo donde se publican las convocatorias y envío de la convocatoria de un evento.
 */
const whatsapp = require('../services/whatsappClient');
const { grupoConvocatorias, guardarGrupoConvocatorias } = require('../services/configuracionService');
const { convocarPorWhatsApp } = require('../services/convocatoriasService');
const { registrarAuditoria } = require('../services/auditService');
const { notFound } = require('../shared/errors');
const { z, id } = require('../shared/schemas');

const grupoSchema = z.object({
  grupoId: z.string({ error: 'Seleccione un grupo.' }).trim().regex(/^[\d-]+@g\.us$/, 'Seleccione un grupo de WhatsApp válido.')
});
const convocatoriaSchema = z.object({ eventoId: id, reenviar: z.boolean().default(false) });

/** Estado de la conexión y grupo elegido. Consultarlo no inicia WhatsApp. */
async function getEstado(req, res) {
  const [estado, grupo] = await Promise.all([whatsapp.estado(), grupoConvocatorias()]);
  return res.json({ status: 'OK', data: { ...estado, grupo } });
}

async function iniciarSesion(req, res) {
  const estado = await whatsapp.iniciar();
  return res.json({ status: 'OK', message: 'Iniciando WhatsApp Web.', data: { ...estado, grupo: await grupoConvocatorias() } });
}

async function cerrarSesion(req, res) {
  const estado = await whatsapp.cerrarSesion();
  await registrarAuditoria({ cuentaId: req.user.cuentaId, accion: 'MODIFICAR', entidad: 'whatsapp', ip: req.ip, detalle: { cerrarSesion: true } });
  return res.json({ status: 'OK', message: 'Sesión de WhatsApp cerrada.', data: { ...estado, grupo: await grupoConvocatorias() } });
}

/** Grupos de la cuenta vinculada, para elegir dónde publicar las convocatorias. */
async function getGrupos(req, res) {
  return res.json({ status: 'OK', data: await whatsapp.listarGrupos() });
}

async function guardarGrupo(req, res) {
  const { grupoId } = grupoSchema.parse(req.body);
  const grupo = (await whatsapp.listarGrupos()).find((g) => g.id === grupoId);
  if (!grupo) throw notFound('La cuenta de WhatsApp de la Junta no pertenece a ese grupo.');

  await guardarGrupoConvocatorias(grupo, req.user.cuentaId);
  await registrarAuditoria({
    cuentaId: req.user.cuentaId, accion: 'MODIFICAR', entidad: 'configuracion', ip: req.ip,
    detalle: { grupoWhatsApp: { id: grupo.id, nombre: grupo.nombre } }
  });
  return res.json({ status: 'OK', message: `Las convocatorias se publicarán en "${grupo.nombre}".`, data: { id: grupo.id, nombre: grupo.nombre } });
}

/** Publicar la convocatoria de una asamblea o minga en el grupo de WhatsApp. */
async function enviarConvocatoria(req, res) {
  const { eventoId, reenviar } = convocatoriaSchema.parse(req.body ?? {});
  const resultado = await convocarPorWhatsApp({ eventoId, reenviar, cuentaId: req.user.cuentaId });
  await registrarAuditoria({
    cuentaId: req.user.cuentaId, accion: 'CONVOCAR', entidad: 'eventos', entidadId: eventoId, ip: req.ip,
    detalle: { canal: 'WHATSAPP', grupo: resultado.grupo.nombre, reenvio: resultado.reenvio, estadoAnterior: resultado.estadoAnterior }
  });
  return res.status(201).json({
    status: 'OK',
    message: `Convocatoria publicada en el grupo "${resultado.grupo.nombre}".`,
    data: { grupo: resultado.grupo, estado: resultado.estado, reenvio: resultado.reenvio }
  });
}

module.exports = { getEstado, iniciarSesion, cerrarSesion, getGrupos, guardarGrupo, enviarConvocatoria };
