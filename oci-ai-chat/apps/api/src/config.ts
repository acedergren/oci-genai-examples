import { z } from 'zod';

const ConfigSchema = z.object({
	port: z
		.string()
		.default('3001')
		.transform((v) => {
			const n = Number(v);
			if (!Number.isFinite(n) || n < 0 || n > 65535) throw new Error(`Invalid PORT: ${v}`);
			return n;
		}),
	host: z.string().default('0.0.0.0'),
	corsOrigin: z.string().default('http://localhost:5173'),
	rateLimitMax: z
		.string()
		.default('100')
		.transform((v) => {
			const n = Number(v);
			if (!Number.isFinite(n) || n < 1) throw new Error(`Invalid RATE_LIMIT_MAX: ${v}`);
			return n;
		}),
	logLevel: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
	nodeEnv: z.enum(['development', 'production', 'test']).default('development')
});

export type AppConfig = z.output<typeof ConfigSchema>;

export function loadConfig(): AppConfig {
	return ConfigSchema.parse({
		port: process.env.PORT,
		host: process.env.HOST,
		corsOrigin: process.env.CORS_ORIGIN,
		rateLimitMax: process.env.RATE_LIMIT_MAX,
		logLevel: process.env.LOG_LEVEL,
		nodeEnv: process.env.NODE_ENV
	});
}
