const db = require('../config/db');
const { registrarAuditoria } = require('../services/auditService');

/**
 * Obtener catálogo de conceptos de cobro y sus tarifas activas
 */
async function getConceptos(req, res, next) {
  try {
    const [conceptos] = await db.query(
      `SELECT c.*,
              (SELECT t.valor FROM tarifas t WHERE t.concepto_id = c.id AND t.activo = TRUE ORDER BY t.vigencia_desde DESC LIMIT 1) AS tarifa_actual
       FROM conceptos_cobro c
       WHERE c.activo = TRUE
       ORDER BY c.nombre ASC`
    );
    return res.json({ status: 'OK', data: conceptos });
  } catch (error) {
    next(error);
  }
}

/**
 * Crear tarifa para un concepto
 */
async function createTarifa(req, res, next) {
  try {
    const { concepto_id, valor, vigencia_desde, vigencia_hasta, observacion } = req.body;

    if (!concepto_id || valor === undefined || !vigencia_desde) {
      return res.status(400).json({ status: 'ERROR', message: 'Concepto, valor y fecha de vigencia desde son requeridos.' });
    }

    if (Number(valor) <= 0) {
      return res.status(400).json({ status: 'ERROR', message: 'El valor de la tarifa debe ser mayor a cero.' });
    }

    const [result] = await db.query(
      `INSERT INTO tarifas (concepto_id, valor, vigencia_desde, vigencia_hasta, observacion)
       VALUES (?, ?, ?, ?, ?)`,
      [concepto_id, valor, vigencia_desde, vigencia_hasta || null, observacion || null]
    );

    return res.status(201).json({ status: 'OK', message: 'Tarifa registrada correctamente.', tarifaId: result.insertId });
  } catch (error) {
    next(error);
  }
}

/**
 * Obtener obligaciones / Cuentas por cobrar
 */
async function getObligaciones(req, res, next) {
  try {
    const { persona_id, estado, anio, mes } = req.query;

    let sql = `SELECT o.*, c.codigo AS concepto_codigo, c.nombre AS concepto_nombre,
                      CONCAT(p.nombres, ' ', p.apellidos) AS comunero_nombre, p.cedula
               FROM obligaciones o
               JOIN personas p ON p.id = o.persona_id
               JOIN conceptos_cobro c ON c.id = o.concepto_id
               WHERE 1=1`;
    const params = [];

    if (persona_id) {
      sql += ` AND o.persona_id = ?`;
      params.push(persona_id);
    }
    if (estado) {
      sql += ` AND o.estado = ?`;
      params.push(estado);
    }
    if (anio) {
      sql += ` AND o.periodo_anio = ?`;
      params.push(anio);
    }
    if (mes) {
      sql += ` AND o.periodo_mes = ?`;
      params.push(mes);
    }

    sql += ` ORDER BY o.fecha_emision DESC`;

    const [obligaciones] = await db.query(sql, params);
    return res.json({ status: 'OK', data: obligaciones });
  } catch (error) {
    next(error);
  }
}

/**
 * Crear obligación de cobro manual
 */
async function createObligacionManual(req, res, next) {
  try {
    const { persona_id, concepto_id, periodo_anio, periodo_mes, fecha_emision, fecha_vencimiento, valor, observacion } = req.body;

    if (!persona_id || !concepto_id || valor === undefined || !fecha_emision) {
      return res.status(400).json({ status: 'ERROR', message: 'Comunero, concepto, fecha de emisión y valor son obligatorios.' });
    }

    if (Number(valor) <= 0) {
      return res.status(400).json({ status: 'ERROR', message: 'El valor de la obligación debe ser mayor a cero.' });
    }

    const [result] = await db.query(
      `INSERT INTO obligaciones (persona_id, concepto_id, periodo_anio, periodo_mes, fecha_emision, fecha_vencimiento, valor, origen, estado, observacion)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'MANUAL', 'PENDIENTE', ?)`,
      [persona_id, concepto_id, periodo_anio || new Date(fecha_emision).getFullYear(), periodo_mes || null, fecha_emision, fecha_vencimiento || null, valor, observacion || null]
    );

    const obligacionId = result.insertId;

    await registrarAuditoria({
      cuentaId: req.user.cuentaId,
      accion: 'CREAR',
      entidad: 'obligaciones',
      entidadId: obligacionId,
      ip: req.ip,
      detalle: { persona_id, concepto_id, valor }
    });

    return res.status(201).json({ status: 'OK', message: 'Obligación creada exitosamente.', obligacionId });
  } catch (error) {
    next(error);
  }
}

/**
 * Anular una obligación pendiente
 */
async function anularObligacion(req, res, next) {
  try {
    const { id } = req.params;
    const { motivo } = req.body;

    if (!motivo) {
      return res.status(400).json({ status: 'ERROR', message: 'Se requiere motivo de anulación.' });
    }

    const [obs] = await db.query(`SELECT estado FROM obligaciones WHERE id = ?`, [id]);
    if (obs.length === 0) {
      return res.status(404).json({ status: 'ERROR', message: 'Obligación no encontrada.' });
    }

    if (obs[0].estado === 'PAGADA') {
      return res.status(400).json({ status: 'ERROR', message: 'No se puede anular una obligación que ya se encuentra PAGADA.' });
    }

    await db.query(
      `UPDATE obligaciones
       SET estado = 'ANULADA', anulada_por_cuenta_id = ?, fecha_anulacion = NOW(), motivo_anulacion = ?
       WHERE id = ?`,
      [req.user.cuentaId, motivo, id]
    );

    await registrarAuditoria({
      cuentaId: req.user.cuentaId,
      accion: 'ANULAR',
      entidad: 'obligaciones',
      entidadId: parseInt(id),
      ip: req.ip,
      detalle: { motivo }
    });

    return res.json({ status: 'OK', message: 'Obligación anulada correctamente.' });
  } catch (error) {
    next(error);
  }
}

/**
 * REGISTRAR PAGO COMPLETO DE OBLIGACIONES (TRANSACCIÓN COMPLETA - SIN PAGOS PARCIALES)
 */
async function registrarPago(req, res, next) {
  const connection = await db.getConnection();
  try {
    const { persona_id, metodo, referencia, observacion, obligacionesIds } = req.body;

    if (!persona_id || !Array.isArray(obligacionesIds) || obligacionesIds.length === 0) {
      return res.status(400).json({ status: 'ERROR', message: 'Se requiere ID del comunero y al menos una obligación a pagar.' });
    }

    await connection.beginTransaction();

    // 1. Obtener y bloquear obligaciones para actualización
    const [obligaciones] = await connection.query(
      `SELECT id, persona_id, valor, estado
       FROM obligaciones
       WHERE id IN (?) FOR UPDATE`,
      [obligacionesIds]
    );

    if (obligaciones.length !== obligacionesIds.length) {
      await connection.rollback();
      return res.status(400).json({ status: 'ERROR', message: 'Una o más obligaciones seleccionadas no existen.' });
    }

    let valorTotalCalculado = 0;

    for (const ob of obligaciones) {
      // Regla de Negocio: Pertenencia al mismo comunero
      if (ob.persona_id !== parseInt(persona_id)) {
        await connection.rollback();
        return res.status(400).json({
          status: 'ERROR',
          message: `La obligación #${ob.id} no pertenece al comunero seleccionado.`
        });
      }

      // Regla de Negocio: Estado debe ser PENDIENTE
      if (ob.estado !== 'PENDIENTE') {
        await connection.rollback();
        return res.status(400).json({
          status: 'ERROR',
          message: `La obligación #${ob.id} ya se encuentra ${ob.estado} y no se puede volver a pagar.`
        });
      }

      valorTotalCalculado += Number(ob.valor);
    }

    // 2. Insertar cabecera de Pago
    const [resPago] = await connection.query(
      `INSERT INTO pagos (persona_id, fecha_pago, valor_total, metodo, referencia, observacion, registrado_por_cuenta_id)
       VALUES (?, NOW(), ?, ?, ?, ?, ?)`,
      [persona_id, valorTotalCalculado, metodo || 'EFECTIVO', referencia || null, observacion || null, req.user.cuentaId]
    );

    const pagoId = resPago.insertId;

    // 3. Actualizar obligaciones a PAGADA e insertar pago_detalles (pago completo de cada una)
    for (const ob of obligaciones) {
      await connection.query(`UPDATE obligaciones SET estado = 'PAGADA' WHERE id = ?`, [ob.id]);

      await connection.query(
        `INSERT INTO pago_detalles (pago_id, obligacion_id, valor_pagado)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE pago_id = VALUES(pago_id), valor_pagado = VALUES(valor_pagado)`,
        [pagoId, ob.id, ob.valor]
      );
    }

    await connection.commit();

    await registrarAuditoria({
      cuentaId: req.user.cuentaId,
      accion: 'CREAR',
      entidad: 'pagos',
      entidadId: pagoId,
      ip: req.ip,
      detalle: { persona_id, valorTotalCalculado, obligacionesIds }
    });

    return res.status(201).json({
      status: 'OK',
      message: 'Pago registrado exitosamente.',
      pagoId,
      valorTotal: valorTotalCalculado
    });

  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
}

/**
 * Listar pagos / Recaudación
 */
async function getPagos(req, res, next) {
  try {
    const { persona_id, desde, hasta } = req.query;

    let sql = `SELECT p.*, CONCAT(per.nombres, ' ', per.apellidos) AS comunero_nombre, per.cedula,
                      CONCAT(reg_per.nombres, ' ', reg_per.apellidos) AS registrado_por_usuario
               FROM pagos p
               JOIN personas per ON per.id = p.persona_id
               LEFT JOIN cuentas c ON c.id = p.registrado_por_cuenta_id
               LEFT JOIN personas reg_per ON reg_per.id = c.persona_id
               WHERE 1=1`;
    const params = [];

    if (persona_id) {
      sql += ` AND p.persona_id = ?`;
      params.push(persona_id);
    }
    if (desde) {
      sql += ` AND p.fecha_pago >= ?`;
      params.push(desde);
    }
    if (hasta) {
      sql += ` AND p.fecha_pago <= ?`;
      params.push(hasta);
    }

    sql += ` ORDER BY p.fecha_pago DESC`;

    const [pagos] = await db.query(sql, params);
    return res.json({ status: 'OK', data: pagos });
  } catch (error) {
    next(error);
  }
}

/**
 * Listar egresos / gastos
 */
async function getEgresos(req, res, next) {
  try {
    const { desde, hasta, proveedor_id } = req.query;

    let sql = `SELECT e.*, prv.nombre AS proveedor_nombre, prv.identificacion AS proveedor_ruc,
                      CONCAT(reg_per.nombres, ' ', reg_per.apellidos) AS registrado_por_usuario
               FROM egresos e
               LEFT JOIN proveedores prv ON prv.id = e.proveedor_id
               LEFT JOIN cuentas c ON c.id = e.registrado_por_cuenta_id
               LEFT JOIN personas reg_per ON reg_per.id = c.persona_id
               WHERE 1=1`;
    const params = [];

    if (proveedor_id) {
      sql += ` AND e.proveedor_id = ?`;
      params.push(proveedor_id);
    }
    if (desde) {
      sql += ` AND e.fecha >= ?`;
      params.push(desde);
    }
    if (hasta) {
      sql += ` AND e.fecha <= ?`;
      params.push(hasta);
    }

    sql += ` ORDER BY e.fecha DESC`;

    const [egresos] = await db.query(sql, params);
    return res.json({ status: 'OK', data: egresos });
  } catch (error) {
    next(error);
  }
}

/**
 * Registrar egreso
 */
async function createEgreso(req, res, next) {
  try {
    const { proveedor_id, fecha, concepto, descripcion, numero_factura, archivo_factura, valor } = req.body;

    if (!fecha || !concepto || valor === undefined) {
      return res.status(400).json({ status: 'ERROR', message: 'Fecha, concepto y valor son requeridos.' });
    }

    if (Number(valor) <= 0) {
      return res.status(400).json({ status: 'ERROR', message: 'El valor del egreso debe ser mayor a cero.' });
    }

    const [result] = await db.query(
      `INSERT INTO egresos (proveedor_id, fecha, concepto, descripcion, numero_factura, archivo_factura, valor, registrado_por_cuenta_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [proveedor_id || null, fecha, concepto.trim(), descripcion || null, numero_factura || null, archivo_factura || null, valor, req.user.cuentaId]
    );

    const egresoId = result.insertId;

    await registrarAuditoria({
      cuentaId: req.user.cuentaId,
      accion: 'CREAR',
      entidad: 'egresos',
      entidadId: egresoId,
      ip: req.ip,
      detalle: { concepto, valor, numero_factura }
    });

    return res.status(201).json({ status: 'OK', message: 'Egreso registrado exitosamente.', egresoId });
  } catch (error) {
    next(error);
  }
}

/**
 * GENERAR BALANCE GENERAL AL DÍA / REPORTE FINANCIERO
 */
async function getBalanceReport(req, res, next) {
  try {
    const { desde, hasta } = req.query;

    let sqlIngresos = `SELECT COALESCE(SUM(valor_total), 0) AS total_ingresos FROM pagos WHERE 1=1`;
    let sqlEgresos = `SELECT COALESCE(SUM(valor), 0) AS total_egresos FROM egresos WHERE 1=1`;
    let sqlPendientes = `SELECT COALESCE(SUM(valor), 0) AS total_pendientes FROM obligaciones WHERE estado = 'PENDIENTE'`;

    const paramsIngresos = [];
    const paramsEgresos = [];

    if (desde) {
      sqlIngresos += ` AND fecha_pago >= ?`;
      sqlEgresos += ` AND fecha >= ?`;
      paramsIngresos.push(desde);
      paramsEgresos.push(desde);
    }
    if (hasta) {
      sqlIngresos += ` AND fecha_pago <= ?`;
      sqlEgresos += ` AND fecha <= ?`;
      paramsIngresos.push(hasta);
      paramsEgresos.push(hasta);
    }

    const [ingresosRes] = await db.query(sqlIngresos, paramsIngresos);
    const [egresosRes] = await db.query(sqlEgresos, paramsEgresos);
    const [pendientesRes] = await db.query(sqlPendientes);

    const totalIngresos = Number(ingresosRes[0].total_ingresos);
    const totalEgresos = Number(egresosRes[0].total_egresos);
    const totalPendientes = Number(pendientesRes[0].total_pendientes);
    const balanceAlDia = totalIngresos - totalEgresos;

    return res.json({
      status: 'OK',
      balance: {
        totalIngresos,
        totalEgresos,
        totalPendientes,
        balanceAlDia,
        fechaReporte: new Date().toISOString()
      }
    });

  } catch (error) {
    next(error);
  }
}

/**
 * Anular un pago previamente registrado
 */
async function anularPago(req, res, next) {
  const connection = await db.getConnection();
  try {
    const { id } = req.params;
    const { motivo } = req.body;

    if (!motivo) {
      return res.status(400).json({ status: 'ERROR', message: 'Se requiere motivo de anulación.' });
    }

    await connection.beginTransaction();

    // 1. Obtener pago
    const [pagos] = await connection.query(`SELECT * FROM pagos WHERE id = ? FOR UPDATE`, [id]);
    if (pagos.length === 0) {
      await connection.rollback();
      return res.status(404).json({ status: 'ERROR', message: 'Pago no encontrado.' });
    }

    const pago = pagos[0];

    if (pago.observacion && pago.observacion.includes('[ANULADO:')) {
      await connection.rollback();
      return res.status(400).json({ status: 'ERROR', message: 'Este pago ya ha sido anulado previamente.' });
    }

    // 2. Obtener obligaciones asociadas en pago_detalles
    const [detalles] = await connection.query(`SELECT obligacion_id FROM pago_detalles WHERE pago_id = ?`, [id]);

    // 3. Restaurar las obligaciones a estado 'PENDIENTE'
    for (const d of detalles) {
      await connection.query(`UPDATE obligaciones SET estado = 'PENDIENTE' WHERE id = ?`, [d.obligacion_id]);
    }

    // 4. Eliminar registros de pago_detalles para liberar las obligaciones
    await connection.query(`DELETE FROM pago_detalles WHERE pago_id = ?`, [id]);

    // 5. Marcar pago como anulado en observaciones
    const obsActual = pago.observacion || '';
    const obsNueva = `${obsActual} [ANULADO: ${motivo}]`.trim();
    await connection.query(`UPDATE pagos SET observacion = ? WHERE id = ?`, [id]);

    await connection.commit();

    await registrarAuditoria({
      cuentaId: req.user.cuentaId,
      accion: 'ANULAR',
      entidad: 'pagos',
      entidadId: id,
      ip: req.ip,
      detalle: { pagoId: id, motivo, valorTotal: pago.valor_total }
    });

    return res.json({ status: 'OK', message: 'Pago anulado exitosamente y obligaciones devueltas a estado PENDIENTE.' });

  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
}

module.exports = {
  getConceptos,
  createTarifa,
  getObligaciones,
  createObligacionManual,
  anularObligacion,
  registrarPago,
  anularPago,
  getPagos,
  getEgresos,
  createEgreso,
  getBalanceReport
};
