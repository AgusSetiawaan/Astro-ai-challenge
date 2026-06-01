import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import type { ChatMessage } from '@/lib/prompt/build';

export interface ClaudeCliOptions {
  messages: ChatMessage[];
  model?: 'sonnet' | 'haiku' | 'opus';
  signal?: AbortSignal;
  /** Path to claude CLI binary; defaults to `claude` on PATH. */
  bin?: string;
  /** Spawn override for tests. */
  spawnFn?: typeof spawn;
}

/**
 * Streams text deltas from the `claude` CLI in print mode.
 *
 * Uses `--output-format=stream-json` and yields the text content of every
 * `{"type":"assistant", message:{content:[{type:"text",text}]}}` line.
 *
 * Bills against whichever Claude account the local CLI is logged in as
 * (Max plan, Pro, or API key — auth is opaque to this caller). Therefore
 * only runs where `claude` is installed and authenticated — typically
 * localhost. Vercel / public deploy will fail unless the binary is shipped
 * and a token is provisioned.
 */
export async function* streamClaude(opts: ClaudeCliOptions): AsyncIterable<string> {
  const bin = opts.bin ?? 'claude';
  const spawnImpl = opts.spawnFn ?? spawn;
  const prompt = serializeMessages(opts.messages);

  const args = ['--print', '--output-format=stream-json', '--verbose'];
  if (opts.model) args.push('--model', opts.model);
  // Disable all tools — we want pure text generation, no agentic behavior.
  args.push('--disallowedTools', 'Bash', 'Read', 'Write', 'Edit', 'Grep', 'Glob', 'Task', 'WebSearch', 'WebFetch');

  const proc = spawnImpl(bin, args, { stdio: ['pipe', 'pipe', 'pipe'] }) as ChildProcessWithoutNullStreams;

  if (opts.signal) {
    if (opts.signal.aborted) {
      proc.kill('SIGTERM');
    } else {
      opts.signal.addEventListener('abort', () => proc.kill('SIGTERM'), { once: true });
    }
  }

  proc.stdin.write(prompt);
  proc.stdin.end();

  let buffer = '';
  const errChunks: Buffer[] = [];
  proc.stderr.on('data', (c: Buffer) => errChunks.push(c));

  for await (const chunk of proc.stdout as AsyncIterable<Buffer>) {
    buffer += chunk.toString('utf8');
    let nl: number;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      const delta = extractDelta(line);
      if (delta) yield delta;
    }
  }

  await new Promise<void>((resolve, reject) => {
    proc.on('close', (code) => {
      if (code === 0 || opts.signal?.aborted) resolve();
      else reject(new Error(`claude CLI exited ${code}: ${Buffer.concat(errChunks).toString('utf8').slice(0, 300)}`));
    });
    proc.on('error', reject);
  });
}

function serializeMessages(messages: ChatMessage[]): string {
  // claude --print accepts a single prompt. Concatenate with explicit role
  // markers so the model sees the system/user split without losing structure.
  const parts: string[] = [];
  for (const m of messages) {
    if (m.role === 'system') parts.push(`# SYSTEM\n${m.content}`);
    else parts.push(`# USER\n${m.content}`);
  }
  return parts.join('\n\n');
}

interface AssistantMessage {
  type: 'assistant';
  message?: { content?: Array<{ type: string; text?: string }> };
}

function extractDelta(line: string): string | null {
  let msg: unknown;
  try {
    msg = JSON.parse(line);
  } catch {
    return null;
  }
  if (
    typeof msg !== 'object' ||
    msg === null ||
    (msg as { type?: unknown }).type !== 'assistant'
  ) {
    return null;
  }
  const blocks = (msg as AssistantMessage).message?.content ?? [];
  let acc = '';
  for (const b of blocks) {
    if (b.type === 'text' && typeof b.text === 'string') acc += b.text;
  }
  return acc || null;
}
