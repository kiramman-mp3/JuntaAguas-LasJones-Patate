const path = require('path');
const crypto = require('crypto');
const { z } = require('zod');

require('dotenv').config({ path: path.join(__dirname, '../../.env'), quiet: true });

// Secretos que estuvieron publicados en el historial del repositorio y no deben usarse nunca.
const SECRETOS_COMPROMETIDOS = new Set([
  'f2241147ea97aa0b03e3af33b5918847cada0c597146336bef29185403b95c9d'
]);

const esquema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DB_HOST: z.string().default('127.0.0.1'),
  DB_PORT: z.coerce.number().int().positive().default(3306),
  DB_USER: z.string().default('root'),
  DB_PASSWORD: z.string().default(''),
  DB_NAME: z.string().regex(/^[A-Za-z0-9_]+$/, 'DB_NAME solo admite letras, números y guion bajo').default('junta_las_jones'),
  JWT_SECRET: z.string({ error: 'JWT_SECRET es obligatorio' })
    .min(32, 'JWT_SECRET debe tener al menos 32 caracteres')
    .refine(
      (s) => !SECRETOS_COMPROMETIDOS.has(crypto.createHash('sha256').update(s).digest('hex')),
      'JWT_SECRET usa un valor que fue publicado en el repositorio; genera uno nuevo'
    ),
  JWT_EXPIRES_IN: z.string().default('8h'),
  FRONTEND_URL: z.string().default('http://localhost:4200'),
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  UPLOADS_DIR: z.string().default(path.join(__dirname, '../../uploads'))
});

const resultado = esquema.safeParse(process.env);
if (!resultado.success) {
  const detalle = resultado.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  throw new Error(`Configuración inválida en backend/.env:\n${detalle}`);
}

const env = resultado.data;

module.exports = {
  ...env,
  esProduccion: env.NODE_ENV === 'production',
  esTest: env.NODE_ENV === 'test'
};
