import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/lib/**/*.test.ts', 'src/client/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/**/*.ts'],
      exclude: ['src/lib/**/__fixtures__/**'],
      thresholds: { lines: 90, functions: 90, branches: 85, statements: 90 },
    },
  },
  resolve: { alias: { '@': new URL('./src', import.meta.url).pathname } },
});
