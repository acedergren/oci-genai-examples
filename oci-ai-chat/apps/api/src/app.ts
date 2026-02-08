import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';

export function buildApp(opts: FastifyServerOptions = {}): FastifyInstance {
  const app = Fastify(opts);

  app.get('/api/health', async () => ({
    status: 'ok',
    service: 'api',
    timestamp: new Date().toISOString()
  }));

  return app;
}
