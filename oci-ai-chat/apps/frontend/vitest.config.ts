import { defineProject } from 'vitest/config';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineProject({
	resolve: {
		alias: {
			$lib: resolve(__dirname, './src/lib')
		}
	},
	test: {
		name: 'frontend',
		include: ['src/**/*.test.ts']
	}
});
