const db = require('../config/db');
const { withTransaction } = require('../shared/transaction');
const { personaPermitida } = require('../shared/roles');
const { notFound, conflict } = require('../shared/errors');
const { idParam } = require('../shared/schemas');
const { registrarAuditoria } = require('../services/auditService');
const archivos = require('../services/documentStorage');

const TABLAS = { GENERAL: 'pagos', AGUA: 'pago_anual_agua' };

/** Crea subir/descargar para la tabla de pagos indicada (multas y otros cobros, o agua anual). */
function crear(tipo) {
  const tabla = TABLAS[tipo];
  const etiqueta = tipo === 'AGUA' ? 'Comprobante_agua' : 'Comprobante_pago';

  async function subir(req, res) {
    const { id } = idParam.parse(req.params);
    let nuevo;
    let anterior;
    try {
      await withTransaction(async (conexion) => {
        const [[pago]] = await conexion.query(`SELECT estado, metodo, comprobante_url FROM ${tabla} WHERE id = ? FOR UPDATE`, [id]);
        if (!pago) throw notFound('Pago no encontrado.');
        if (pago.estado !== 'VIGENTE') throw conflict('No se puede modificar el comprobante de un pago anulado.');
        if (!['TRANSFERENCIA', 'DEPOSITO'].includes(pago.metodo)) throw conflict('Solo los pagos por transferencia o depósito admiten comprobante bancario.');
        nuevo = await archivos.guardarDocumento(req.file?.buffer, 'pago_comprobante');
        anterior = pago.comprobante_url;
        await conexion.query(`UPDATE ${tabla} SET comprobante_url = ? WHERE id = ?`, [nuevo.url, id]);
        await registrarAuditoria({ conexion, cuentaId: req.user.cuentaId, accion: 'MODIFICAR', entidad: tabla, entidadId: id,
          ip: req.ip, detalle: { comprobanteBancario: true, reemplazado: Boolean(anterior) } });
      });
    } catch (error) {
      if (nuevo) await archivos.eliminarDocumento(nuevo.url);
      throw error;
    }
    if (anterior) await archivos.eliminarDocumento(anterior);
    return res.json({ status: 'OK', message: 'Comprobante bancario guardado.' });
  }

  async function descargar(req, res) {
    const { id } = idParam.parse(req.params);
    const [[pago]] = await db.query(`SELECT persona_id, comprobante_url FROM ${tabla} WHERE id = ?`, [id]);
    if (!pago || personaPermitida(req.user, pago.persona_id) !== pago.persona_id) throw notFound('Pago no encontrado.');
    const nombre = archivos.nombreDesdeUrl(pago.comprobante_url);
    const ruta = archivos.rutaSegura(nombre);
    if (!ruta) throw notFound('Este pago no tiene comprobante bancario adjunto.');
    res.set({ 'Content-Type': archivos.mimeDe(nombre), 'Content-Disposition': `attachment; filename="${etiqueta}_${id}.${nombre.split('.').pop()}"`,
      'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
    return res.sendFile(ruta, error => {
      if (error && !res.headersSent) res.status(404).json({ status: 'ERROR', message: 'Archivo no encontrado.' });
    });
  }

  return { subir, descargar };
}

module.exports = { general: crear('GENERAL'), agua: crear('AGUA') };
