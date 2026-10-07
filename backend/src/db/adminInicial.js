/**
 * Primer administrador de una base de datos limpia. Sin él nadie puede iniciar sesión,
 * porque las cuentas solo las crea un administrador desde el panel.
 * Solo actúa si no existe ninguna cuenta ADMIN activa; nunca modifica cuentas existentes.
 */
const { esCedulaValida } = require('../shared/schemas');
const { generarPasswordTemporal, hashPassword } = require('../shared/passwords');

function validarDatos({ cedula, nombres, apellidos }) {
  const problemas = [];
  if (!esCedulaValida(String(cedula ?? ''))) problemas.push('ADMIN_CEDULA debe ser una cédula ecuatoriana válida de 10 dígitos.');
  if (!String(nombres ?? '').trim()) problemas.push('ADMIN_NOMBRES es obligatorio.');
  if (!String(apellidos ?? '').trim()) problemas.push('ADMIN_APELLIDOS es obligatorio.');
  return problemas;
}

/**
 * @returns {Promise<{ creado: false } | { creado: true, cedula: string, nombre: string, passwordTemporal: string }>}
 */
async function asegurarAdminInicial(conexion, datos) {
  const [admins] = await conexion.query(
    "SELECT c.id FROM cuentas c JOIN roles r ON r.id = c.rol_id WHERE r.codigo = 'ADMIN' AND c.estado = 'ACTIVA' LIMIT 1"
  );
  if (admins.length) return { creado: false };

  const problemas = validarDatos(datos);
  if (problemas.length) {
    throw new Error(`No hay ningún administrador y faltan datos para crear el primero:\n  - ${problemas.join('\n  - ')}\nDefínalos en backend/.env.`);
  }

  const cedula = String(datos.cedula).trim();
  const nombres = String(datos.nombres).trim();
  const apellidos = String(datos.apellidos).trim();
  const passwordTemporal = generarPasswordTemporal(12);

  await conexion.beginTransaction();
  try {
    const [roles] = await conexion.query("SELECT id FROM roles WHERE codigo = 'ADMIN'");
    if (!roles.length) throw new Error('El rol ADMIN no existe: ejecute primero las migraciones.');

    const [existentes] = await conexion.query('SELECT id FROM personas WHERE cedula = ?', [cedula]);
    let personaId = existentes[0]?.id;
    if (!personaId) {
      const [r] = await conexion.query('INSERT INTO personas (cedula, nombres, apellidos) VALUES (?, ?, ?)', [cedula, nombres, apellidos]);
      personaId = r.insertId;
    }
    const [cuentas] = await conexion.query('SELECT id FROM cuentas WHERE persona_id = ?', [personaId]);
    if (cuentas.length) {
      throw new Error(`La persona con cédula ${cedula} ya tiene una cuenta que no es de administrador activa. Use otra cédula o actívela manualmente.`);
    }
    // debe_cambiar_password: la contraseña temporal sirve solo para el primer ingreso.
    await conexion.query(
      `INSERT INTO cuentas (persona_id, rol_id, password_hash, debe_cambiar_password, estado) VALUES (?, ?, ?, TRUE, 'ACTIVA')`,
      [personaId, roles[0].id, await hashPassword(passwordTemporal)]
    );
    await conexion.commit();
  } catch (error) {
    await conexion.rollback();
    throw error;
  }
  return { creado: true, cedula, nombre: `${nombres} ${apellidos}`, passwordTemporal };
}

module.exports = { asegurarAdminInicial, validarDatos };
