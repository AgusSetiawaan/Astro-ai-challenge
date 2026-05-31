import OpenAI from 'openai';
import type { ChatCompletionCreateParamsStreaming } from 'openai/resources/chat/completions';
import type { ChatMessage } from '@/lib/prompt/build';

export interface DeepSeekOptions {
  apiKey: string;
  baseURL?: string;
}

export interface ChatStreamOptions {
  messages: ChatMessage[];
  useThinking?: boolean;
  signal?: AbortSignal;
}

const DEFAULT_BASE = 'https://api.deepseek.com/v1';
const MODEL = 'deepseek-v4-flash';

export function createDeepSeekClient(opts: DeepSeekOptions) {
  const client = new OpenAI({ apiKey: opts.apiKey, baseURL: opts.baseURL ?? DEFAULT_BASE });

  return {
    async *chatStream(args: ChatStreamOptions): AsyncIterable<string> {
      // NOTE: verify thinking-mode toggle in DeepSeek docs at implementation
      // time. If a separate model id is required, branch here.
      const body: ChatCompletionCreateParamsStreaming = {
        model: MODEL,
        messages: args.messages.map((m) => ({ role: m.role, content: m.content })),
        stream: true,
      };
      // DeepSeek-specific extension not in OpenAI's typed params.
      (body as unknown as Record<string, unknown>).enable_thinking = args.useThinking ?? false;
      const stream = await client.chat.completions.create(body, { signal: args.signal });
      for await (const chunk of stream) {
        const delta = chunk.choices?.[0]?.delta?.content;
        if (delta) yield delta;
      }
    },
  };
}
