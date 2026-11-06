// El bloqueo por intentos fallidos pasa de la cuenta a cada par (cuenta, IP): quien adivina contraseñas
// queda bloqueado desde su equipo, pero no deja fuera al dueño legítimo de la cuenta, que entra desde otra red.
// El estado de bloqueo es transitorio (15 minutos), por eso se descartan las columnas anteriores.
module.exports.up = async (db, { dropColumnIfExists }) => {
  await db.query(`CREATE TABLE IF NOT EXISTS intentos_login (
    cuenta_id BIGINT NOT NULL,
    ip VARCHAR(45) NOT NULL,
    intentos INT NOT NULL DEFAULT 0,
    bloqueado_hasta DATETIME NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (cuenta_id, ip),
    INDEX idx_intentos_login_bloqueo (bloqueado_hasta),
    FOREIGN KEY (cuenta_id) REFERENCES cuentas(id) ON DELETE CASCADE
  ) ENGINE=InnoDB COMMENT='Intentos fallidos de inicio de sesión por cuenta e IP (UTC)'`);

  await dropColumnIfExists(db, 'cuentas', 'intentos_fallidos');
  await dropColumnIfExists(db, 'cuentas', 'bloqueada_hasta');
};
