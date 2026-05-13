import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: false,  // MCP is run as subprocess - JS build sufficient
  splitting: false,
  sourcemap: true,
  clean: true,
  external: ['@kontextmind/core'],
});