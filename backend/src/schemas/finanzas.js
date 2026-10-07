/** Esquemas zod de las rutas financieras. */
const s = require('../shared/schemas');
const { hoy } = require('../shared/dates');
const { z } = s;

const ESTADOS_OBLIGACION = ['PENDIENTE', 'PAGADA', 'ANULADA'];
const METODOS = ['EFECTIVO', 'TRANSFERENCIA', 'DEPOSITO', 'OTRO'];
const anio = z.coerce.number().int().min(2000).max(2100);
const mes = z.coerce.number().int().min(1).max(12);

const obligacionesQuery = z.object({
  persona_id: s.id.optional(),
  estado: z.enum(ESTADOS_OBLIGACION).optional(),
  anio: anio.optional(),
  mes: mes.optional()
});

const porCedulaQuery = z.object({
  cedula: z.string({ error: 'Debe enviar la cédula del comunero.' }).trim().regex(/^\d{10}$/, 'La cédula debe tener 10 dígitos.'),
  estado: z.enum(ESTADOS_OBLIGACION).optional(),
  anio: anio.optional(),
  mes: mes.optional()
});

const tarifaSchema = z.object({
  concepto_id: s.id,
  valor: s.montoPositivo,
  vigencia_desde: s.fecha,
  vigencia_hasta: s.fechaOpcional,
  observacion: s.textoOpcional(255)
}).refine((d) => !d.vigencia_hasta || d.vigencia_hasta >= d.vigencia_desde, {
  path: ['vigencia_hasta'], message: 'La vigencia final debe ser posterior a la inicial.'
});

const obligacionSchema = z.object({
  persona_id: s.id,
  concepto_id: s.id,
  periodo_anio: anio.optional(),
  periodo_mes: z.preprocess((v) => (v === '' ? null : v), mes.nullish()),
  fecha_emision: s.fecha,
  fecha_vencimiento: s.fechaOpcional,
  valor: s.montoPositivo,
  observacion: s.textoOpcional(255)
});

const textoObservacion = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() ? v.trim() : null),
  z.string().max(255).nullable()
);

const pagoSchema = z.object({
  persona_id: s.id,
  obligacionesIds: z.array(s.id, { error: 'Seleccione al menos una obligación a pagar.' }).min(1, 'Seleccione al menos una obligación a pagar.').max(200),
  metodo: z.enum(METODOS).default('EFECTIVO'),
  referencia: s.textoOpcional(100),
  observacion: textoObservacion.optional(),
  observaciones: textoObservacion.optional()
}).refine((d) => d.metodo === 'EFECTIVO' || d.referencia, {
  path: ['referencia'], message: 'Ingrese el número de referencia de la transferencia o depósito.'
});

const motivoSchema = z.object({ motivo: z.string({ error: 'Se requiere motivo de anulación.' }).trim().min(5, 'Describa el motivo (mínimo 5 caracteres).').max(255) });

const rangoFechas = z.object({ desde: s.fecha.optional(), hasta: s.fecha.optional() })
  .refine((d) => !d.desde || !d.hasta || d.desde <= d.hasta, { message: 'La fecha inicial debe ser anterior a la final.' });

const egresosQuery = rangoFechas.and(z.object({ proveedor: z.string().trim().max(150).optional() }));
const pagosQuery = rangoFechas.and(z.object({ persona_id: s.id.optional(), estado: z.enum(['VIGENTE', 'ANULADO']).optional() }));

const egresoSchema = z.object({
  fecha: s.fecha.refine((f) => f <= hoy(), 'La fecha del egreso no puede ser futura.'),
  concepto: z.string().trim().min(3, 'Indique el concepto del egreso.').max(200),
  proveedor: s.textoOpcional(150),
  ruc_proveedor: z.preprocess((v) => (v === '' ? null : v), z.string().trim().regex(/^\d{10}(\d{3})?$/, 'El RUC/cédula del proveedor debe tener 10 o 13 dígitos.').nullish()).transform((v) => v ?? null),
  descripcion: s.textoOpcional(2000),
  numero_factura: z.preprocess((v) => (v === '' ? null : v), z.string().trim().regex(/^[\d-]{1,30}$/, 'Número de factura inválido (ej. 001-001-000012345).').nullish()).transform((v) => v ?? null),
  valor: s.montoPositivo
});

const facturacionSchema = z.object({ anio, mes, simular: z.boolean().default(false) });
const resumenFacturacionQuery = z.object({ anio: anio.optional() });

module.exports = {
  ESTADOS_OBLIGACION, METODOS, obligacionesQuery, porCedulaQuery, tarifaSchema, obligacionSchema, pagoSchema,
  motivoSchema, rangoFechas, egresosQuery, pagosQuery, egresoSchema, facturacionSchema, resumenFacturacionQuery
};
