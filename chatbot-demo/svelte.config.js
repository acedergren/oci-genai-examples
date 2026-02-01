import adapterCloudflare from '@sveltejs/adapter-cloudflare';
import adapterNode from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

// Use Node adapter for Docker builds, Cloudflare for edge deployment
const useNodeAdapter = process.env.ADAPTER === 'node';

const adapter = useNodeAdapter
	? adapterNode({ out: 'build' })
	: adapterCloudflare({
			routes: {
				include: ['/*'],
				exclude: ['<all>']
			}
		});

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: { adapter }
};

export default config;
