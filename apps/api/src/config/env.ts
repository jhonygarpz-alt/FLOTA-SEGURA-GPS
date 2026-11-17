import { z } from 'zod';

/** Validación estricta de variables de entorno. Nunca se escriben valores reales en el repositorio. */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET debe tener al menos 32 caracteres'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET debe tener al menos 32 caracteres'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_DAYS: z.coerce.number().default(14),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  // Traccar (opcional: sin estas variables la plataforma funciona solo en modo demostración)
  TRACCAR_URL: z.string().url().optional().or(z.literal('')),
  TRACCAR_ADMIN_EMAIL: z.string().optional(),
  TRACCAR_ADMIN_PASSWORD: z.string().optional(),
  // Secreto compartido con el proxy HTTPS (Caddy) del VPS: oculta Traccar al público
  TRACCAR_PROXY_SECRET: z.string().optional(),
  TRUST_PROXY_HOPS: z.coerce.number().default(1),
  // Host público (IP o dominio) que se configura en los equipos GPS
  TRACCAR_PUBLIC_HOST: z.string().default(''),
  DEVICE_OFFLINE_MINUTES: z.coerce.number().default(10),
  DEMO_ENABLED: z
    .string()
    .default('true')
    .transform((v) => v === 'true'),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;
export function env(): Env {
  if (!cached) {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n');
      throw new Error(`Configuración inválida:\n${msg}`);
    }
    cached = parsed.data;
  }
  return cached;
}

export function traccarConfigured(): boolean {
  const e = env();
  return Boolean(e.TRACCAR_URL && e.TRACCAR_ADMIN_EMAIL && e.TRACCAR_ADMIN_PASSWORD);
}
