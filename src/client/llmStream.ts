import type { ChatMessage } from '@/lib/prompt/build';

export interface LlmStreamArgs {
  messages: ChatMessage[];
  useThinking?: boolean;
  byokKey?: string;
  signal?: AbortSignal;
}

export async function* streamLlm(args: LlmStreamArgs): AsyncIterable<string> {
  const res = await fetch('/api/llm', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(args),
    signal: args.signal,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new LlmHttpError(res.status, body);
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
      let obj: { delta?: string; error?: string };
      try {
        obj = JSON.parse(payload);
      } catch {
        continue; // skip malformed SSE payloads instead of killing the stream
      }
      if (obj.error) throw new Error(obj.error);
      if (obj.delta) yield obj.delta;
    }
  }
}

export class LlmHttpError extends Error {
  constructor(public status: number, public body: string) {
    super(`LLM HTTP ${status}: ${body.slice(0, 200)}`);
    this.name = 'LlmHttpError';
  }
}
