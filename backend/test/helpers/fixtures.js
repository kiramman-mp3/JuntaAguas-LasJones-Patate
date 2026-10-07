const db = require('../../src/config/db');
const { hashPassword } = require('../../src/shared/passwords');
const { firmarToken } = require('../../src/middlewares/authMiddleware');

let secuencia = 0;

/** Genera una cédula ecuatoriana válida (provincia 18, Tungurahua). */
function generarCedula(n = ++secuencia) {
  const base = `18${String(n).padStart(7, '0')}`.slice(0, 9);
  let suma = 0;
  for (let i = 0; i < 9; i++) {
    let v = Number(base[i]) * (i % 2 === 0 ? 2 : 1);
    if (v >= 10) v -= 9;
    suma += v;
  }
  return base + (suma % 10 === 0 ? 0 : 10 - (suma % 10));
}

async function crearPersona({ nombres = 'Persona', apellidos = 'De Prueba', estado = 'ACTIVO', celular = null } = {}) {
  const cedula = generarCedula();
  const [r] = await db.query(
    'INSERT INTO personas (cedula, nombres, apellidos, celular, estado) VALUES (?, ?, ?, ?, ?)',
    [cedula, nombres, apellidos, celular, estado]
  );
  return { personaId: r.insertId, cedula };
}

/** Crea persona + cuenta con el rol indicado y devuelve un token de sesión válido. */
async function crearUsuario({ rol = 'USUARIO', password = 'Clave1234', debeCambiar = false, estadoCuenta = 'ACTIVA', ...persona } = {}) {
  const { personaId, cedula } = await crearPersona(persona);
  const [[{ id: rolId }]] = await db.query('SELECT id FROM roles WHERE codigo = ?', [rol]);
  const [r] = await db.query(
    'INSERT INTO cuentas (persona_id, rol_id, password_hash, debe_cambiar_password, estado) VALUES (?, ?, ?, ?, ?)',
    [personaId, rolId, await hashPassword(password), debeCambiar, estadoCuenta]
  );
  const usuario = { cuentaId: r.insertId, personaId, cedula, rol, password };
  return { ...usuario, token: firmarToken(usuario) };
}

const auth = (usuario) => ({ Authorization: `Bearer ${usuario.token}` });

async function conceptoId(codigo) {
  const [[fila]] = await db.query('SELECT id FROM conceptos_cobro WHERE codigo = ?', [codigo]);
  return fila.id;
}

async function crearObligacion({ personaId, codigo = 'AGUA_MENSUAL', anio = 2026, mes = 1, valor = 4, estado = 'PENDIENTE', eventoId = null }) {
  const [r] = await db.query(
    `INSERT INTO obligaciones (persona_id, concepto_id, evento_id, periodo_anio, periodo_mes, fecha_emision, valor, origen, estado)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'AUTOMATICA', ?)`,
    [personaId, await conceptoId(codigo), eventoId, anio, mes, `${anio}-${String(mes || 1).padStart(2, '0')}-01`, valor, estado]
  );
  return r.insertId;
}

async function crearSector(nombre = `Sector ${++secuencia}`) {
  const [r] = await db.query('INSERT INTO sectores (nombre) VALUES (?)', [nombre]);
  return r.insertId;
}

async function crearLote({ sectorId, personaId = null, codigo = `LJA-${String(++secuencia).padStart(3, '0')}` }) {
  const [r] = await db.query('INSERT INTO lotes (sector_id, codigo, superficie_m2) VALUES (?, ?, 1000)', [sectorId, codigo]);
  if (personaId) {
    await db.query("INSERT INTO persona_lotes (persona_id, lote_id, tipo_relacion) VALUES (?, ?, 'PROPIETARIO')", [personaId, r.insertId]);
  }
  return r.insertId;
}

module.exports = { generarCedula, crearPersona, crearUsuario, auth, conceptoId, crearObligacion, crearSector, crearLote };
