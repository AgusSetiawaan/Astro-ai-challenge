import type { FixEvent } from '@/types';

export interface FixStreamArgs {
  projectPath: string;
  baseBranch: string;
  ticket: import('@/types').TicketDraft;
  classified: import('@/types').ClassifiedFrame[];
  deobfCrash: import('@/types').DeobfCrash;
  snippet?: string;
  model?: 'sonnet' | 'haiku';
  signal?: AbortSignal;
}

export class FixHttpError extends Error {
  constructor(public status: number, public body: string) {
    super(`Fix HTTP ${status}: ${body.slice(0, 200)}`);
    this.name = 'FixHttpError';
  }
}

export async function* streamFix(args: FixStreamArgs): AsyncIterable<FixEvent> {
  const res = await fetch('/api/fix', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(args),
    signal: args.signal,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new FixHttpError(res.status, body);
  }
  if (!res.body) throw new Error('No response body');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n\n');
    buf = lines.pop() ?? '';
    for (const line of lines) {
      const m = line.match(/^data:\s*(.*)$/m);
      if (!m) continue;
      const payload = m[1];
      if (payload === '[DONE]') return;
      let obj: unknown;
      try {
        obj = JSON.parse(payload);
      } catch {
        continue;
      }
      if (obj && typeof obj === 'object' && 'type' in obj) {
        yield obj as FixEvent;
      }
    }
  }
}
