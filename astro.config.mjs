import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import node from '@astrojs/node';
import vercel from '@astrojs/vercel';

// Adapter is picked at build time: Vercel's runtime sets VERCEL=1 during
// `vercel build`. Locally (pnpm dev / pnpm build) we use @astrojs/node.
const isVercel = process.env.VERCEL === '1' || process.env.VERCEL === 'true';

// Astro 5 removed `output: 'hybrid'`. Static + adapter + per-route
// `export const prerender = false;` is the documented replacement: pages prerender
// by default, API routes (src/pages/api/*) opt into SSR via the configured adapter.
export default defineConfig({
  output: 'static',
  adapter: isVercel ? vercel({ webAnalytics: { enabled: false } }) : node({ mode: 'standalone' }),
  devToolbar: { enabled: false },
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
