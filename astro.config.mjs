import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import node from '@astrojs/node';

// Astro 5 removed `output: 'hybrid'`. Static + adapter + per-route
// `export const prerender = false;` is the documented replacement: pages prerender
// by default, API routes (src/pages/api/*) opt into SSR via the node adapter.
export default defineConfig({
  output: 'static',
  adapter: node({ mode: 'standalone' }),
  integrations: [react(), tailwind({ applyBaseStyles: false })],
  vite: {
    worker: { format: 'es' },
    resolve: {
      // Prevent dual-React copies (Astro SSR pulls one, vite optimizeDeps
      // bundles another). "Invalid hook call" / useState=null without this.
      dedupe: ['react', 'react-dom'],
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
    },
  },
});
