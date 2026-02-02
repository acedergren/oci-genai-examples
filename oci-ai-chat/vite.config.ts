import { defineConfig } from 'vite';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [sveltekit(), tailwindcss()],
  optimizeDeps: {
    exclude: ['@tanstack/svelte-query'],
  },
  ssr: {
    noExternal: ['@tanstack/svelte-query'],
  },
});
