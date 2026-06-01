import type { APIRoute } from 'astro';
import { streamFix } from '@/server/claudeAgentic';
import { validateProject, listBranches } from '@/server/projectGuard';
import { createRateLimiter } from '@/server/rateLimit';
import { buildFixPrompt } from '@/lib/prompt/buildFixPrompt';
import type { DeobfCrash, ClassifiedFrame, TicketDraft } from '@/types';

export const prerender = false;

let cachedLimiter: { perHour: number; limiter: ReturnType<typeof createRateLimiter> } | null = null;
function getLimiter(perHour: number) {
  if (!cachedLimiter || cachedLimiter.perHour !== perHour) {
    cachedLimiter = { perHour, limiter: createRateLimiter({ perHour }) };
  }
  return cachedLimiter.limiter;
}

interface FixReqBody {
  projectPath: string;
  baseBranch: string;
  ticket: TicketDraft;
  classified: ClassifiedFrame[];
  deobfCrash: DeobfCrash;
  snippet?: string;
  model?: 'sonnet' | 'haiku';
}

function badJson(msg: string) {
  return new Response(JSON.stringify({ error: msg }), {
    status: 400,
    headers: { 'content-type': 'application/json' },
  });
}

function isValidBody(b: unknown): b is FixReqBody {
  if (!b || typeof b !== 'object') return false;
  const x = b as Partial<FixReqBody>;
  return (
    typeof x.projectPath === 'string' &&
    typeof x.baseBranch === 'string' &&
    !!x.ticket &&
    Array.isArray(x.classified) &&
    !!x.deobfCrash
  );
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  if (process.env.VERCEL) {
    return new Response(
      JSON.stringify({ error: 'Try Fix is unavailable on Vercel — needs local claude CLI + filesystem access. Self-host (pnpm dev) to use it.' }),
      { status: 503, headers: { 'content-type': 'application/json' } }
    );
  }
  const PER_HOUR = Number(import.meta.env.RATE_LIMIT_PER_HOUR ?? 20);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badJson('Invalid JSON');
  }
  if (!isValidBody(body)) return badJson('Bad payload shape');

  const r = getLimiter(PER_HOUR).check(clientAddress ?? 'unknown');
  if (!r.ok) {
    return new Response(JSON.stringify({ error: 'rate_limited', resetAt: r.resetAt }), {
      status: 429,
      headers: { 'content-type': 'application/json' },
    });
  }

  const guard = await validateProject(body.projectPath);
  if (!guard.ok) return badJson(guard.reason);

  let branches: string[];
  try {
    branches = await listBranches(guard.path);
  } catch (e) {
    return badJson(`git branch list failed: ${(e as Error).message}`);
  }
  if (!branches.includes(body.baseBranch)) {
    return badJson(`baseBranch "${body.baseBranch}" not found in ${guard.path}`);
  }

  const prompt = buildFixPrompt({
    crash: body.deobfCrash,
    classified: body.classified,
    ticket: body.ticket,
    snippet: body.snippet,
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const ev of streamFix({
          prompt,
          cwd: guard.path,
          baseBranch: body.baseBranch,
          model: body.model ?? 'sonnet',
          signal: request.signal,
        })) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(ev)}\n\n`));
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      } catch (e) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'error', message: (e as Error).message })}\n\n`)
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-store',
      'x-accel-buffering': 'no',
    },
  });
};
