/** Ajustes generales guardados en la tabla configuracion (clave/valor). */
const db = require('../config/db');

const CLAVES = Object.freeze({
  WHATSAPP_GRUPO_ID: 'whatsapp.grupo_id',
  WHATSAPP_GRUPO_NOMBRE: 'whatsapp.grupo_nombre'
});

async function leer(claves) {
  const [filas] = await db.query('SELECT clave, valor FROM configuracion WHERE clave IN (?)', [claves]);
  return Object.fromEntries(filas.map((f) => [f.clave, f.valor]));
}

/** Grupo de WhatsApp donde se publican las convocatorias, o null si aún no se eligió. */
async function grupoConvocatorias() {
  const valores = await leer([CLAVES.WHATSAPP_GRUPO_ID, CLAVES.WHATSAPP_GRUPO_NOMBRE]);
  const id = valores[CLAVES.WHATSAPP_GRUPO_ID];
  return id ? { id, nombre: valores[CLAVES.WHATSAPP_GRUPO_NOMBRE] || id } : null;
}

async function guardarGrupoConvocatorias({ id, nombre }, cuentaId) {
  await db.query(
    `INSERT INTO configuracion (clave, valor, updated_by_cuenta_id) VALUES (?, ?, ?), (?, ?, ?)
     ON DUPLICATE KEY UPDATE valor = VALUES(valor), updated_by_cuenta_id = VALUES(updated_by_cuenta_id)`,
    [CLAVES.WHATSAPP_GRUPO_ID, id, cuentaId, CLAVES.WHATSAPP_GRUPO_NOMBRE, nombre, cuentaId]
  );
}

module.exports = { CLAVES, grupoConvocatorias, guardarGrupoConvocatorias };
