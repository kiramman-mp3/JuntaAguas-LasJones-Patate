// Noticias de la Junta: se publican en el portal (las 5 más recientes en "Noticias" y el archivo completo con filtros)
// y las administra la directiva. Las etiquetas viven en su propia tabla para poder filtrar con índice.
module.exports.up = async (db) => {
  await db.query(`CREATE TABLE IF NOT EXISTS noticias (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    titulo VARCHAR(160) NOT NULL,
    descripcion_corta VARCHAR(300) NOT NULL,
    descripcion_larga TEXT NOT NULL,
    imagen_url VARCHAR(255) NOT NULL,
    publicada_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    creada_por_cuenta_id BIGINT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_noticias_publicada (publicada_en),
    FOREIGN KEY (creada_por_cuenta_id) REFERENCES cuentas(id) ON DELETE SET NULL
  ) ENGINE=InnoDB COMMENT='Noticias publicadas en el portal de la Junta'`);

  await db.query(`CREATE TABLE IF NOT EXISTS noticia_etiquetas (
    noticia_id BIGINT NOT NULL,
    etiqueta VARCHAR(30) NOT NULL,
    PRIMARY KEY (noticia_id, etiqueta),
    INDEX idx_noticia_etiquetas_etiqueta (etiqueta),
    FOREIGN KEY (noticia_id) REFERENCES noticias(id) ON DELETE CASCADE
  ) ENGINE=InnoDB COMMENT='Etiquetas de cada noticia (en minúsculas)'`);
};
