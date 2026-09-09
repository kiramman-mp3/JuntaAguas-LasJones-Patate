const db = require('../config/db');
const { registrarAuditoria } = require('../services/auditService');

/**
 * Validar estructura básica de Cédula Ecuatoriana (10 dígitos)
 */
function validarCedulaEcuatoriana(cedula) {
  if (!cedula || typeof cedula !== 'string') return false;
  const clean = cedula.trim();
  if (!/^\d{10}$/.test(clean)) return false;

  const provincia = parseInt(clean.substring(0, 2), 10);
  if ((provincia < 1 || provincia > 24) && provincia !== 30) return false;

  const tercerDigito = parseInt(clean.substring(2, 3), 10);
  if (tercerDigito >= 6) return false; // Persona natural

  const coeficientes = [2, 1, 2, 1, 2, 1, 2, 1, 2];
  const verificador = parseInt(clean.substring(9, 10), 10);
  let suma = 0;

  for (let i = 0; i < 9; i++) {
    let valor = parseInt(clean.substring(i, i + 1), 10) * coeficientes[i];
    if (valor >= 10) valor -= 9;
    suma += valor;
  }

  const digitoObtenido = (suma % 10 === 0) ? 0 : 10 - (suma % 10);
  return digitoObtenido === verificador;
}

/**
 * Listar y buscar personas / comuneros
 */
async function getPersonas(req, res, next) {
  try {
    const { busqueda, estado, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let sql = `SELECT p.id, p.cedula, p.nombres, p.apellidos, p.direccion, p.telefono, p.celular, p.email, p.fecha_nacimiento, p.estado, p.created_at,
                      (SELECT COUNT(*) FROM persona_lotes pl WHERE pl.persona_id = p.id) AS lotes_count
               FROM personas p
               WHERE 1=1`;
    const params = [];

    if (estado) {
      sql += ` AND p.estado = ?`;
      params.push(estado);
    }

    if (busqueda) {
      sql += ` AND (p.cedula LIKE ? OR p.nombres LIKE ? OR p.apellidos LIKE ?)`;
      const term = `%${busqueda.trim()}%`;
      params.push(term, term, term);
    }

    sql += ` ORDER BY p.apellidos ASC, p.nombres ASC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), parseInt(offset));

    const [personas] = await db.query(sql, params);

    const [totalRows] = await db.query(`SELECT COUNT(*) AS total FROM personas`);

    return res.json({
      status: 'OK',
      data: personas,
      pagination: {
        total: totalRows[0].total,
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Obtener detalle completo de una persona (lotes, turnos, deudas)
 */
async function getPersonaById(req, res, next) {
  try {
    const { id } = req.params;

    const [rows] = await db.query(`SELECT * FROM personas WHERE id = ?`, [id]);
    if (rows.length === 0) {
      return res.status(404).json({ status: 'ERROR', message: 'Comunero no encontrado.' });
    }

    const persona = rows[0];

    // Obtener lotes vinculados
    const [lotes] = await db.query(
      `SELECT l.*, s.nombre AS sector_nombre, pl.tipo_relacion, pl.porcentaje
       FROM persona_lotes pl
       JOIN lotes l ON l.id = pl.lote_id
       JOIN sectores s ON s.id = l.sector_id
       WHERE pl.persona_id = ?`,
      [id]
    );

    // Obtener turnos de agua
    const [turnos] = await db.query(
      `SELECT t.*, l.codigo AS lote_codigo, s.nombre AS sector_nombre
       FROM turnos_riego t
       LEFT JOIN lotes l ON l.id = t.lote_id
       LEFT JOIN sectores s ON s.id = l.sector_id
       WHERE t.persona_id = ? AND t.estado = 'ACTIVO'`,
      [id]
    );

    // Obtener obligaciones pendientes
    const [obligaciones] = await db.query(
      `SELECT o.*, c.codigo AS concepto_codigo, c.nombre AS concepto_nombre
       FROM obligaciones o
       JOIN conceptos_cobro c ON c.id = o.concepto_id
       WHERE o.persona_id = ? AND o.estado = 'PENDIENTE'
       ORDER BY o.fecha_emision DESC`,
      [id]
    );

    return res.json({
      status: 'OK',
      persona,
      lotes,
      turnos,
      obligaciones
    });
  } catch (error) {
    next(error);
  }
}

/**
 * ENDPOINT PÚBLICO: Consulta de Deudas y Multas por Cédula (Utilizado por la consulta web)
 */
async function consultaPublicaPorCedula(req, res, next) {
  try {
    const { cedula } = req.params;
    const cleanCedula = cedula ? cedula.trim() : '';

    if (!cleanCedula) {
      return res.status(400).json({ status: 'ERROR', message: 'Se requiere número de cédula.' });
    }

    const [personaRows] = await db.query(
      `SELECT p.id, p.cedula, p.nombres, p.apellidos, p.estado
       FROM personas p
       WHERE p.cedula = ?`,
      [cleanCedula]
    );

    if (personaRows.length === 0) {
      return res.status(404).json({
        status: 'ERROR',
        message: 'No se encontró ningún comunero registrado con la cédula ingresada.'
      });
    }

    const persona = personaRows[0];

    // Obtener información del sector y lote principal
    const [lotesRows] = await db.query(
      `SELECT l.codigo AS lote_codigo, s.nombre AS sector_nombre
       FROM persona_lotes pl
       JOIN lotes l ON l.id = pl.lote_id
       JOIN sectores s ON s.id = l.sector_id
       WHERE pl.persona_id = ? LIMIT 1`,
      [persona.id]
    );

    const loteInfo = lotesRows.length > 0 ? lotesRows[0] : { lote_codigo: 'N/A', sector_nombre: 'Sin sector asignado' };

    // Obtener todas las obligaciones (PENDIENTE y PAGADA recientes)
    const [obligaciones] = await db.query(
      `SELECT o.id, o.periodo_anio, o.periodo_mes, o.fecha_emision, o.valor, o.estado, o.observacion,
              c.nombre AS concepto_nombre, c.codigo AS concepto_codigo
       FROM obligaciones o
       JOIN conceptos_cobro c ON c.id = o.concepto_id
       WHERE o.persona_id = ?
       ORDER BY o.estado DESC, o.fecha_emision DESC`,
      [persona.id]
    );

    const totalPendiente = obligaciones
      .filter(o => o.estado === 'PENDIENTE')
      .reduce((sum, o) => sum + Number(o.valor), 0);

    return res.json({
      status: 'OK',
      resultado: {
        cedula: persona.cedula,
        nombres: `${persona.nombres} ${persona.apellidos}`,
        sector: loteInfo.sector_nombre,
        loteCodigo: loteInfo.lote_codigo,
        totalPendiente,
        deudas: obligaciones.map(o => ({
          id: o.id,
          concepto: o.concepto_nombre,
          anio: o.periodo_anio || new Date(o.fecha_emision).getFullYear(),
          periodo: o.periodo_mes ? `Mes ${o.periodo_mes}` : (o.observacion || 'Cuota/Multa'),
          valor: Number(o.valor),
          estado: o.estado,
          fechaEmision: o.fecha_emision
        }))
      }
    });

  } catch (error) {
    next(error);
  }
}

/**
 * Crear nueva persona / comunero
 */
async function createPersona(req, res, next) {
  try {
    const { cedula, nombres, apellidos, direccion, telefono, celular, email, fecha_nacimiento, crearCuenta, rol_id } = req.body;

    if (!cedula || !nombres || !apellidos) {
      return res.status(400).json({ status: 'ERROR', message: 'Cédula, nombres y apellidos son campos obligatorios.' });
    }

    const cleanCedula = cedula.trim();

    // Validar cédula única
    const [exist] = await db.query(`SELECT id FROM personas WHERE cedula = ?`, [cleanCedula]);
    if (exist.length > 0) {
      return res.status(400).json({ status: 'ERROR', message: `Ya existe un comunero registrado con la cédula ${cleanCedula}.` });
    }

    const [result] = await db.query(
      `INSERT INTO personas (cedula, nombres, apellidos, direccion, telefono, celular, email, fecha_nacimiento)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [cleanCedula, nombres.trim(), apellidos.trim(), direccion || null, telefono || null, celular || null, email || null, fecha_nacimiento || null]
    );

    const personaId = result.insertId;

    // Crear cuenta opcional si se especifica
    if (crearCuenta && rol_id) {
      const bcrypt = require('bcryptjs');
      const tempPassword = cleanCedula; // Contraseña por defecto igual a la cédula
      const passwordHash = await bcrypt.hash(tempPassword, 10);

      await db.query(
        `INSERT INTO cuentas (persona_id, rol_id, password_hash, debe_cambiar_password, creada_por_cuenta_id)
         VALUES (?, ?, ?, TRUE, ?)`,
        [personaId, rol_id, passwordHash, req.user ? req.user.cuentaId : null]
      );
    }

    await registrarAuditoria({
      cuentaId: req.user ? req.user.cuentaId : null,
      accion: 'CREAR',
      entidad: 'personas',
      entidadId: personaId,
      ip: req.ip,
      detalle: { cedula: cleanCedula, nombres, apellidos }
    });

    return res.status(201).json({
      status: 'OK',
      message: 'Comunero registrado exitosamente.',
      personaId
    });

  } catch (error) {
    next(error);
  }
}

/**
 * Actualizar persona
 */
async function updatePersona(req, res, next) {
  try {
    const { id } = req.params;
    const { nombres, apellidos, direccion, telefono, celular, email, fecha_nacimiento, estado } = req.body;

    const [rows] = await db.query(`SELECT id FROM personas WHERE id = ?`, [id]);
    if (rows.length === 0) {
      return res.status(404).json({ status: 'ERROR', message: 'Comunero no encontrado.' });
    }

    await db.query(
      `UPDATE personas
       SET nombres = ?, apellidos = ?, direccion = ?, telefono = ?, celular = ?, email = ?, fecha_nacimiento = ?, estado = ?
       WHERE id = ?`,
      [nombres, apellidos, direccion || null, telefono || null, celular || null, email || null, fecha_nacimiento || null, estado || 'ACTIVO', id]
    );

    await registrarAuditoria({
      cuentaId: req.user ? req.user.cuentaId : null,
      accion: 'MODIFICAR',
      entidad: 'personas',
      entidadId: parseInt(id),
      ip: req.ip,
      detalle: { nombres, apellidos, estado }
    });

    return res.json({ status: 'OK', message: 'Datos del comunero actualizados correctamente.' });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getPersonas,
  getPersonaById,
  consultaPublicaPorCedula,
  createPersona,
  updatePersona
};
