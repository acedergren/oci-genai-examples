import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],

  server: {
    host: '127.0.0.1', // Use IPv4 instead of IPv6 to avoid permission issues
    port: 8765,
    strictPort: false, // If port is taken, try next available port
  },

  optimizeDeps: {
    include: ['ai', '@ai-sdk/svelte'],
    exclude: ['@acedergren/oci-genai-provider'],
  },

  // Suppress punycode deprecation warning (from uri-js dependency)
  build: {
    rollupOptions: {
      onwarn(warning, warn) {
        // Suppress punycode deprecation warnings
        if (warning.code === 'MODULE_LEVEL_DIRECTIVE') return;
        warn(warning);
      },
    },
  },
});
