import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/cli.ts'],
  format: ['esm'],
  clean: true,
  bundle: true,
  // Mark opentui packages as external - they use import attributes (type: "file")
  // that esbuild doesn't support. These will be loaded from node_modules at runtime.
  external: ['@opentui/core', '@opentui/react'],
  noExternal: [
    '@acedergren/oci-genai-provider',
    'yoga-layout-prebuilt',
    'ai',
    'pino',
    'commander',
    'inquirer',
    'chalk',
    'eventsource-parser',
    'oci-common',
    'oci-generativeaiinference',
    'oci-aispeech',
    'oci-identity',
    'oci-objectstorage',
    'zod',
  ],
  minify: true,
  sourcemap: false,
  target: 'node20',
  shims: true,
});
