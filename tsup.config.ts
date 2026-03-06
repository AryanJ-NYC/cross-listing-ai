import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/cli.ts'],
  clean: true,
  dts: true,
  format: ['esm', 'cjs'],
  minify: false,
  outDir: 'dist',
  platform: 'node',
  shims: false,
  sourcemap: true,
  target: 'node20',
});
