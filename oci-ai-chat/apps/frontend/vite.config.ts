import { defineConfig } from 'vite';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
	plugins: [sveltekit(), tailwindcss()],
	optimizeDeps: {
		exclude: ['@tanstack/svelte-query']
	},
	ssr: {
		noExternal: ['@tanstack/svelte-query']
	},
	build: {
		sourcemap: false, // Prevent .map files in production client bundles
		rollupOptions: {
			external: ['ws', '@sentry/node', '@ai-sdk/azure'] // ws: oci-genai-provider realtime; @sentry/node: lazy-loaded in sentry.ts; @ai-sdk/azure: optional provider, dynamic import
		}
	}
});
