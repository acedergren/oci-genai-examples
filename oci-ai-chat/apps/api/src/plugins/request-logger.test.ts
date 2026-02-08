import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import requestLoggerPlugin from './request-logger.js';

function buildTestApp() {
	const app = Fastify({ logger: false });
	app.register(requestLoggerPlugin);
	// Echo back request ID from the decorated request
	app.get('/test', (request, reply) => {
		return reply.send({ requestId: request.id });
	});
	return app;
}

describe('request-logger plugin', () => {
	it('generates a request ID with req- prefix when none provided', async () => {
		const app = buildTestApp();

		const res = await app.inject({ method: 'GET', url: '/test' });

		const body = res.json();
		expect(body.requestId).toMatch(/^req-/);
	});

	it('reuses X-Request-Id header from client', async () => {
		const app = buildTestApp();

		const res = await app.inject({
			method: 'GET',
			url: '/test',
			headers: { 'x-request-id': 'req-from-frontend' }
		});

		const body = res.json();
		expect(body.requestId).toBe('req-from-frontend');
	});

	it('sets X-Request-Id on the response', async () => {
		const app = buildTestApp();

		const res = await app.inject({ method: 'GET', url: '/test' });

		expect(res.headers['x-request-id']).toBeDefined();
		expect(res.headers['x-request-id']).toMatch(/^req-/);
	});

	it('sanitizes non-string X-Request-Id headers', async () => {
		const app = buildTestApp();

		// Empty string should generate a new ID
		const res = await app.inject({
			method: 'GET',
			url: '/test',
			headers: { 'x-request-id': '' }
		});

		const body = res.json();
		expect(body.requestId).toMatch(/^req-/);
	});
});
