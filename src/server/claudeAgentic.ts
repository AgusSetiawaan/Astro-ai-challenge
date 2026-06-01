import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { promisify } from 'node:util';
import { exec } from 'node:child_process';
import type { FixEvent, FixResult } from '@/types';
import { parseFixOutput, FixOutputError } from '@/lib/fix/parseFixOutput';

const execP = promisify(exec);

export interface AgenticOpts {
  prompt: string;
  cwd: string;
  baseBranch: string;
  model?: 'sonnet' | 'haiku' | 'opus';
  signal?: AbortSignal;
  bin?: string;
  spawnFn?: typeof spawn;
  /** Test override: skip the upfront `git checkout`. */
  skipCheckout?: boolean;
}

/**
 * Runs `claude --print` in agentic mode against the user's project:
 * 1. Checks out `baseBranch` (so the new fix branch forks off it).
 * 2. Spawns claude with Read/Grep/Glob/Edit/Bash enabled, `--permission-mode acceptEdits`.
 * 3. Yields `FixEvent`s as the stream comes in:
 *    - `text` for assistant prose
 *    - `tool_use` for tool invocations
 *    - `tool_result` for tool outputs
 *    - `final` when the closing JSON summary parses cleanly
 *    - `error` on subprocess or parse failure
 */
export async function* streamFix(opts: AgenticOpts): AsyncIterable<FixEvent> {
  const bin = opts.bin ?? 'claude';
  const spawnImpl = opts.spawnFn ?? spawn;
  const model = opts.model ?? 'sonnet';

  if (!opts.skipCheckout) {
    try {
      await execP(`git -C ${JSON.stringify(opts.cwd)} checkout ${JSON.stringify(opts.baseBranch)}`);
    } catch (e) {
      yield { type: 'error', message: `git checkout ${opts.baseBranch} failed: ${(e as Error).message.slice(0, 300)}` };
      return;
    }
  }

  const args = [
    '--print',
    '--output-format=stream-json',
    '--verbose',
    '--model', model,
    '--permission-mode', 'acceptEdits',
    '--allowedTools', 'Read', 'Grep', 'Glob', 'Edit', 'Bash',
    '--disallowedTools', 'Write', 'Task', 'WebSearch', 'WebFetch',
  ];

  const proc = spawnImpl(bin, args, {
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd: opts.cwd,
  }) as ChildProcessWithoutNullStreams;

  if (opts.signal) {
    if (opts.signal.aborted) proc.kill('SIGTERM');
    else opts.signal.addEventListener('abort', () => proc.kill('SIGTERM'), { once: true });
  }

  proc.stdin.write(opts.prompt);
  proc.stdin.end();

  const errChunks: Buffer[] = [];
  proc.stderr.on('data', (c: Buffer) => errChunks.push(c));

  let textBuffer = '';
  let stdoutBuf = '';
  for await (const chunk of proc.stdout as AsyncIterable<Buffer>) {
    stdoutBuf += chunk.toString('utf8');
    let nl: number;
    while ((nl = stdoutBuf.indexOf('\n')) >= 0) {
      const line = stdoutBuf.slice(0, nl).trim();
      stdoutBuf = stdoutBuf.slice(nl + 1);
      if (!line) continue;
      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch {
        continue;
      }
      for (const ev of extractEvents(parsed)) {
        if (ev.type === 'text') textBuffer += ev.text;
        yield ev;
      }
    }
  }

  await new Promise<void>((resolve, reject) => {
    proc.on('close', (code) => {
      if (code === 0 || opts.signal?.aborted) resolve();
      else reject(new Error(`claude CLI exited ${code}: ${Buffer.concat(errChunks).toString('utf8').slice(0, 300)}`));
    });
    proc.on('error', reject);
  });

  if (textBuffer.trim().length > 0) {
    try {
      const result: FixResult = parseFixOutput(textBuffer);
      yield { type: 'final', result };
    } catch (e) {
      if (e instanceof FixOutputError) {
        yield { type: 'error', message: `Claude finished but final JSON did not parse: ${e.message}` };
      } else {
        throw e;
      }
    }
  }
}

interface ContentBlock {
  type: string;
  text?: string;
  name?: string;
  input?: unknown;
  id?: string;
  tool_use_id?: string;
  content?: unknown;
  is_error?: boolean;
}

interface ClaudeJsonMessage {
  type?: string;
  message?: { content?: ContentBlock[] };
}

function extractEvents(raw: unknown): FixEvent[] {
  if (typeof raw !== 'object' || raw === null) return [];
  const m = raw as ClaudeJsonMessage;
  const events: FixEvent[] = [];
  const blocks = m.message?.content ?? [];
  for (const b of blocks) {
    if (b.type === 'text' && typeof b.text === 'string' && b.text.length > 0) {
      events.push({ type: 'text', text: b.text });
    } else if (b.type === 'tool_use' && typeof b.name === 'string') {
      events.push({ type: 'tool_use', name: b.name, input: b.input, id: b.id });
    } else if (b.type === 'tool_result') {
      const output = stringifyToolResult(b.content);
      events.push({
        type: 'tool_result',
        toolUseId: b.tool_use_id,
        output: output.slice(0, 500),
        isError: b.is_error === true,
      });
    }
  }
  return events;
}

function stringifyToolResult(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((c) => (typeof c === 'object' && c && 'text' in c ? String((c as { text: unknown }).text) : JSON.stringify(c)))
      .join('\n');
  }
  if (content && typeof content === 'object') return JSON.stringify(content);
  return '';
}
