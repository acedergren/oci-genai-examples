import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import {
	serializerCompiler,
	validatorCompiler
} from 'fastify-type-provider-zod';
import { loadConfig, type AppConfig } from './config.js';
import errorHandlerPlugin from './plugins/error-handler.js';
import requestLoggerPlugin, { redactHeaders } from './plugins/request-logger.js';
import corsPlugin from './plugins/cors.js';
import rateLimitPlugin from './plugins/rate-limit.js';
import helmetPlugin from './plugins/helmet.js';

/** Routes that do not require authentication. */
const PUBLIC_ROUTES = new Set(['/api/health']);

export interface BuildAppOptions extends FastifyServerOptions {
	config?: AppConfig;
}

export function buildApp(opts: BuildAppOptions = {}): FastifyInstance {
	const config = opts.config ?? loadConfig();

	const app = Fastify({
		...opts,
		bodyLimit: 512 * 1024, // 512 KiB global default (API-M-1)
		logger: opts.logger ?? {
			level: config.logLevel,
			serializers: {
				req(request) {
					return {
						method: request.method,
						url: request.url,
						headers: redactHeaders(request.headers as Record<string, string | string[] | undefined>),
						hostname: request.hostname,
						remoteAddress: request.ip,
					};
				}
			}
		}
	});

	// Zod type provider for schema validation on routes
	app.setValidatorCompiler(validatorCompiler);
	app.setSerializerCompiler(serializerCompiler);

	// Plugin registration order matters:
	// 1. Error handler first — catches errors from all subsequent plugins/routes
	app.register(errorHandlerPlugin);

	// 2. Request ID + logging hooks
	app.register(requestLoggerPlugin);

	// 3. Security headers
	app.register(helmetPlugin);

	// 4. CORS
	app.register(corsPlugin, { corsOrigin: config.corsOrigin });

	// 5. Rate limiting
	app.register(rateLimitPlugin, { rateLimitMax: config.rateLimitMax });

	// Deny-by-default: reject unauthenticated requests unless route is public (API-M-3)
	// This hook runs after session plugin populates request.user.
	// Routes must be in PUBLIC_ROUTES or the request must have a valid session.
	app.addHook('onRequest', async (request, reply) => {
		if (PUBLIC_ROUTES.has(request.url.split('?')[0])) return;
		if (!request.user) {
			return reply.code(401).send({ error: 'Unauthorized' });
		}
	});

	// Health endpoint (outside versioned API, public)
	app.get('/api/health', async () => ({
		status: 'ok',
		service: 'api',
		timestamp: new Date().toISOString()
	}));

	return app;
}
