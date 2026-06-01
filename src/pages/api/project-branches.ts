import type { APIRoute } from 'astro';
import { validatePath, listBranches, currentBranch, defaultBranch } from '@/server/projectGuard';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  if (process.env.VERCEL) {
    return new Response(
      JSON.stringify({ error: 'Try Fix is unavailable on Vercel — needs local filesystem + git.' }),
      { status: 503, headers: { 'content-type': 'application/json' } }
    );
  }
  const path = url.searchParams.get('path');
  if (!path) {
    return new Response(JSON.stringify({ error: 'missing ?path' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }
  const guard = await validatePath(path);
  if (!guard.ok) {
    return new Response(JSON.stringify({ error: guard.reason }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }
  try {
    const [branches, def, cur] = await Promise.all([
      listBranches(guard.path),
      defaultBranch(guard.path),
      currentBranch(guard.path),
    ]);
    return new Response(JSON.stringify({ branches, defaultBranch: def, current: cur }), {
      headers: { 'content-type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
};
