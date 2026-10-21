import { z } from 'zod';

/**
 * Validacion de la configuracion al arrancar. Si falta un secreto el
 * proceso no levanta, en lugar de fallar mas tarde en produccion.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().url(),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET debe tener al menos 32 caracteres'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET debe tener al menos 32 caracteres'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),

  CONTRATOS_DIR: z.string().default('./contratos'),
});

export type Env = z.infer<typeof envSchema>;

export function validarEnv(crudo: Record<string, unknown>): Env {
  const resultado = envSchema.safeParse(crudo);

  if (!resultado.success) {
    const detalle = resultado.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Configuracion invalida:\n${detalle}\n\nRevise apps/api/.env`);
  }

  return resultado.data;
}
