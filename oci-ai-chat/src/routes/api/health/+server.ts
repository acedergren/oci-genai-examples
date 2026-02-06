import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { execFile } from 'node:child_process';

const APP_VERSION = '0.1.0';

function checkOciCli(): Promise<boolean> {
	return new Promise((resolve) => {
		execFile('oci', ['--version'], { timeout: 5000 }, (error) => {
			resolve(!error);
		});
	});
}

export const GET: RequestHandler = async () => {
	const ociCliAvailable = await checkOciCli();

	const status = ociCliAvailable ? 'ok' : 'degraded';

	return json({
		status,
		timestamp: new Date().toISOString(),
		uptime: process.uptime(),
		version: APP_VERSION,
		checks: {
			oci_cli: ociCliAvailable
		}
	});
};
