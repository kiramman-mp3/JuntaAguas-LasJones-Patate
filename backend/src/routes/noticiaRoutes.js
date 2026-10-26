const express = require('express');
const noticiaController = require('../controllers/noticiaController');
const { soloAdmin } = require('../middlewares/authMiddleware');
const { recibirArchivo } = require('../services/documentStorage');

const router = express.Router();

/**
 * @openapi
 * /noticias:
 *   get:
 *     tags: [Noticias]
 *     summary: Noticias publicadas, de la más reciente a la más antigua (público)
 *     parameters:
 *       - { in: query, name: q, schema: { type: string }, description: Texto en título, descripción corta o etiquetas }
 *       - { in: query, name: tag, schema: { type: string }, description: Etiqueta exacta }
 *       - { in: query, name: desde, schema: { type: string, format: date } }
 *       - { in: query, name: hasta, schema: { type: string, format: date } }
 *       - { in: query, name: pagina, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limite, schema: { type: integer, default: 10, maximum: 50 } }
 *   post:
 *     tags: [Noticias]
 *     summary: Publicar una noticia (ADMIN). multipart/form-data con titulo, descripcion_corta, descripcion_larga, tags (JSON) y archivo (imagen JPG/PNG)
 *     security: [{ bearerAuth: [] }]
 * /noticias/etiquetas:
 *   get:
 *     tags: [Noticias]
 *     summary: Etiquetas en uso con su cantidad de noticias (público)
 * /noticias/{id}:
 *   get:
 *     tags: [Noticias]
 *     summary: Noticia completa (público)
 *   put:
 *     tags: [Noticias]
 *     summary: Modificar una noticia; la imagen solo se reemplaza si se adjunta (ADMIN)
 *     security: [{ bearerAuth: [] }]
 *   delete:
 *     tags: [Noticias]
 *     summary: Eliminar una noticia y su imagen (ADMIN)
 *     security: [{ bearerAuth: [] }]
 */
router.get('/', noticiaController.listar);
router.get('/etiquetas', noticiaController.listarEtiquetas);
router.get('/:id', noticiaController.obtener);
router.post('/', ...soloAdmin, recibirArchivo, noticiaController.crear);
router.put('/:id', ...soloAdmin, recibirArchivo, noticiaController.actualizar);
router.delete('/:id', ...soloAdmin, noticiaController.eliminar);

module.exports = router;
