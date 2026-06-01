import type { APIRoute } from 'astro';
import { streamClaude } from '@/server/claudeCli';
import { createDeepSeekClient } from '@/server/deepseek';
import { createRateLimiter } from '@/server/rateLimit';
import type { ChatMessage } from '@/lib/prompt/build';

export const prerender = false;

// Backend split: local dev/self-host uses claude CLI subprocess (free against
// your Max plan). Vercel-deployed instance has no claude CLI, so DeepSeek
// HTTP API is used instead (billed against DEEPSEEK_API_KEY).
function pickBackend(): 'deepseek' | 'claude-cli' {
  if (process.env.DEEPSEEK_API_KEY && process.env.DEEPSEEK_API_KEY.length > 0) return 'deepseek';
  if (process.env.VERCEL) return 'deepseek'; // will fail clearly below if no key
  return 'claude-cli';
}

async function* streamFromBackend(args: { messages: ChatMessage[]; useThinking?: boolean; signal?: AbortSignal }): AsyncIterable<string> {
  if (pickBackend() === 'deepseek') {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) throw new Error('DEEPSEEK_API_KEY env var not set');
    const client = createDeepSeekClient({ apiKey, baseURL: process.env.DEEPSEEK_BASE_URL });
    yield* client.chatStream({ messages: args.messages, useThinking: args.useThinking, signal: args.signal });
    return;
  }
  yield* streamClaude({
    messages: args.messages,
    model: args.useThinking ? 'sonnet' : 'haiku',
    signal: args.signal,
  });
}

// Lazily-built limiter keyed by configured per-hour value so test env overrides
// (via vi.stubEnv) take effect at request time rather than module-load time.
let cachedLimiter: { perHour: number; limiter: ReturnType<typeof createRateLimiter> } | null = null;
function getLimiter(perHour: number) {
  if (!cachedLimiter || cachedLimiter.perHour !== perHour) {
    cachedLimiter = { perHour, limiter: createRateLimiter({ perHour }) };
  }
  return cachedLimiter.limiter;
}

interface LlmReqBody {
  messages: ChatMessage[];
  useThinking?: boolean;
  /** Reserved; ignored for claude CLI backend (auth is via local `claude` login). */
  byokKey?: string;
}

function isMessageArray(x: unknown): x is ChatMessage[] {
  return Array.isArray(x) && x.every(
    (m) => m && typeof (m as ChatMessage).content === 'string' && ['system', 'user'].includes((m as ChatMessage).role)
  );
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const PER_HOUR = Number(import.meta.env.RATE_LIMIT_PER_HOUR ?? 20);
  const MAX_BYTES = Number(import.meta.env.RATE_LIMIT_MAX_PAYLOAD_BYTES ?? 32768);

  let body: LlmReqBody;
  try {
    body = await request.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }
  if (!isMessageArray(body.messages)) return new Response('Bad messages shape', { status: 400 });

  const totalBytes = body.messages.reduce((n, m) => n + (m.content?.length ?? 0), 0);
  if (totalBytes > MAX_BYTES) return new Response('Payload too large', { status: 413 });

  const usingByok = typeof body.byokKey === 'string' && body.byokKey.length > 0;
  if (!usingByok) {
    const r = getLimiter(PER_HOUR).check(clientAddress ?? 'unknown');
    if (!r.ok) {
      return new Response(JSON.stringify({ error: 'rate_limited', resetAt: r.resetAt }), {
        status: 429,
        headers: { 'content-type': 'application/json' },
      });
    }
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const delta of streamFromBackend({
          messages: body.messages,
          useThinking: body.useThinking,
          signal: request.signal,
        })) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta })}\n\n`));
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      } catch (e) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: (e as Error).message })}\n\n`));
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
