/** Esquemas zod de las rutas de eventos (asambleas y mingas). */
const { z, fecha, hora, textoOpcional } = require('../shared/schemas');

const TIPOS = ['ASAMBLEA', 'MINGA'];
const ESTADOS = ['BORRADOR', 'PROGRAMADO', 'CONVOCADO', 'REALIZADO', 'CANCELADO'];

const listarSchema = z.object({
  tipo: z.enum(TIPOS).optional(),
  estado: z.enum(ESTADOS).optional(),
  desde: fecha.optional(),
  hasta: fecha.optional()
});

const crearSchema = z.object({
  tipo: z.enum(TIPOS, { error: 'El tipo debe ser ASAMBLEA o MINGA.' }),
  titulo: z.string().trim().min(3, 'El título debe tener al menos 3 caracteres.').max(200),
  descripcion: textoOpcional(2000),
  fecha,
  hora_inicio: hora,
  hora_fin: z.preprocess((v) => (v === '' ? null : v), hora.nullish()).transform((v) => v ?? null),
  lugar: textoOpcional(255),
  requiere_asistencia: z.boolean().default(true),
  genera_multa_ausencia: z.boolean().default(true),
  // valor_multa no se recibe: se toma de la tarifa vigente del concepto de multa.
  puntos_orden_dia: z.array(z.union([
    z.string(),
    z.object({ punto_tratar: z.string(), tratado: z.string().nullish(), resolucion: z.string().nullish() })
  ])).max(50).default([])
}).superRefine((d, ctx) => {
  if (d.hora_fin && d.hora_fin <= d.hora_inicio) {
    ctx.addIssue({ code: 'custom', path: ['hora_fin'], message: 'La hora de fin debe ser posterior a la de inicio.' });
  }
});

const puntoSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  orden: z.coerce.number().int().min(1).max(200).optional(),
  punto_tratar: z.string().trim().max(5000).optional(),
  titulo_acta: z.string().trim().max(255).nullish(),
  tratado: z.string().max(20000).nullish(),
  resolucion: z.string().max(20000).nullish(),
  responsables: z.string().trim().max(255).nullish(),
  estado_acta: z.enum(['BORRADOR', 'APROBADA', 'FIRMADA']).optional(),
  fecha_acta: z.string().nullish()
});
const puntosSchema = z.object({ puntos: z.array(puntoSchema).max(100) });

const actaPuntoSchema = z.object({
  estado_acta: z.enum(['BORRADOR', 'APROBADA', 'FIRMADA']).optional(),
  resolucion: z.string().max(20000).nullish(),
  tratado: z.string().max(20000).nullish(),
  responsables: z.string().trim().max(255).nullish(),
  titulo_acta: z.string().trim().max(255).nullish()
});

const documentoSchema = z.object({
  tipo: z.enum(['CONVOCATORIA', 'ACTA', 'RESOLUCION', 'OTRO'], { error: 'Tipo de documento inválido.' }),
  punto_id: z.coerce.number().int().positive().optional()
});

const puntoParam = z.object({ id: z.coerce.number().int().positive(), puntoId: z.coerce.number().int().positive() });

module.exports = { TIPOS, ESTADOS, listarSchema, crearSchema, puntosSchema, actaPuntoSchema, documentoSchema, puntoParam };
