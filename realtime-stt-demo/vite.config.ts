import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  // Ensure browser-compatible builds
  build: {
    target: 'esnext'
  },
  // Allow imports from parent workspace
  server: {
    fs: {
      allow: ['../..']
    }
  }
});
