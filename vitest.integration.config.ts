import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/server/**/*.test.ts', 'src/pages/api/**/*.test.ts', 'src/workers/**/*.test.ts'],
    setupFiles: ['./src/__test__/integration.setup.ts'],
  },
  resolve: { alias: { '@': new URL('./src', import.meta.url).pathname } },
});
