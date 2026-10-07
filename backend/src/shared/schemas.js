const { z } = require('zod');
const { esFechaValida, normalizarHora } = require('./dates');

/** Valida el dígito verificador de una cédula ecuatoriana de persona natural. */
function esCedulaValida(cedula) {
  if (typeof cedula !== 'string' || !/^\d{10}$/.test(cedula)) return false;
  const provincia = Number(cedula.slice(0, 2));
  if ((provincia < 1 || provincia > 24) && provincia !== 30) return false;
  if (Number(cedula[2]) >= 6) return false;
  let suma = 0;
  for (let i = 0; i < 9; i++) {
    let valor = Number(cedula[i]) * (i % 2 === 0 ? 2 : 1);
    if (valor >= 10) valor -= 9;
    suma += valor;
  }
  const verificador = suma % 10 === 0 ? 0 : 10 - (suma % 10);
  return verificador === Number(cedula[9]);
}

const vacioANull = (v) => (typeof v === 'string' && v.trim() === '' ? null : v);

/** Texto opcional: '' o undefined se guardan como null. */
const textoOpcional = (max) => z.preprocess(vacioANull, z.string().trim().max(max).nullish()).transform((v) => v ?? null);

const id = z.coerce.number().int().positive();
const idParam = z.object({ id });
const cedula = z.string().trim().refine(esCedulaValida, 'La cédula no es una cédula ecuatoriana válida.');
const fecha = z.string().refine(esFechaValida, 'Fecha inválida (use AAAA-MM-DD).');
const fechaOpcional = z.preprocess(vacioANull, fecha.nullish()).transform((v) => v ?? null);
const hora = z.string().transform((v, ctx) => {
  const normalizada = normalizarHora(v);
  if (!normalizada) {
    ctx.addIssue({ code: 'custom', message: 'Hora inválida (use HH:MM).' });
    return z.NEVER;
  }
  return normalizada;
});
const dinero = z.coerce.number().finite().multipleOf(0.01, 'Use como máximo dos decimales.');
const montoPositivo = dinero.positive('El valor debe ser mayor a cero.').max(1000000);
const celular = z.preprocess(vacioANull, z.string().trim().regex(/^09\d{8}$/, 'El celular debe tener 10 dígitos y empezar con 09.').nullish()).transform((v) => v ?? null);
const telefono = z.preprocess(vacioANull, z.string().trim().regex(/^0[2-7]\d{7}$/, 'El teléfono fijo debe tener 9 dígitos (ej. 032870112).').nullish()).transform((v) => v ?? null);
const email = z.preprocess(vacioANull, z.string().trim().toLowerCase().email('Correo electrónico inválido.').max(150).nullish()).transform((v) => v ?? null);

const paginacion = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25)
});

module.exports = {
  z, esCedulaValida, textoOpcional, id, idParam, cedula, fecha, fechaOpcional, hora,
  dinero, montoPositivo, celular, telefono, email, paginacion
};
