import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/cli.ts'],
  clean: true,
  dts: false,
  format: ['esm'],
  minify: false,
  outDir: 'dist',
  platform: 'node',
  shims: false,
  sourcemap: true,
  target: 'node20',
});
