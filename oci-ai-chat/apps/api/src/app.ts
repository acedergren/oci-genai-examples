import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import {
	serializerCompiler,
	validatorCompiler
} from 'fastify-type-provider-zod';
import { loadConfig, type AppConfig } from './config.js';
import errorHandlerPlugin from './plugins/error-handler.js';
import requestLoggerPlugin from './plugins/request-logger.js';
import corsPlugin from './plugins/cors.js';
import rateLimitPlugin from './plugins/rate-limit.js';
import helmetPlugin from './plugins/helmet.js';

export interface BuildAppOptions extends FastifyServerOptions {
	config?: AppConfig;
}

export function buildApp(opts: BuildAppOptions = {}): FastifyInstance {
	const config = opts.config ?? loadConfig();

	const app = Fastify({
		...opts,
		logger: opts.logger ?? {
			level: config.logLevel
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

	// Health endpoint (outside versioned API)
	app.get('/api/health', async () => ({
		status: 'ok',
		service: 'api',
		timestamp: new Date().toISOString()
	}));

	return app;
}
