import { loadConfig } from './config.js';
import { buildApp } from './app.js';

const config = loadConfig();
const app = buildApp({ config });

// Graceful shutdown
const shutdown = async (signal: string) => {
	app.log.info({ signal }, 'Shutting down');
	await app.close();
	process.exit(0);
};

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

try {
	await app.listen({ port: config.port, host: config.host });
} catch (err) {
	app.log.error(err);
	process.exit(1);
}
