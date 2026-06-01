import type { APIRoute } from 'astro';
import { scanProjects } from '@/server/scanProjects';
import { createRateLimiter } from '@/server/rateLimit';

export const prerender = false;

let cached: { perHour: number; limiter: ReturnType<typeof createRateLimiter> } | null = null;
function getLimiter(perHour: number) {
  if (!cached || cached.perHour !== perHour) {
    cached = { perHour, limiter: createRateLimiter({ perHour }) };
  }
  return cached.limiter;
}

export const GET: APIRoute = async ({ clientAddress }) => {
  const r = getLimiter(5).check(clientAddress ?? 'unknown');
  if (!r.ok) {
    return new Response(JSON.stringify({ error: 'rate_limited', resetAt: r.resetAt }), {
      status: 429,
      headers: { 'content-type': 'application/json' },
    });
  }
  try {
    const candidates = await scanProjects();
    return new Response(JSON.stringify({ candidates }), {
      headers: { 'content-type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
};
