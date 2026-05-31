import { describe, it, expect, vi, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { mswServer } from '@/__test__/integration.setup';
import { POST } from './llm';

function makeContext(body: unknown, ip = '1.2.3.4'): { request: Request; clientAddress: string } {
  return {
    request: new Request('http://localhost/api/llm', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    }),
    clientAddress: ip,
  };
}

beforeEach(() => {
  vi.stubEnv('DEEPSEEK_API_KEY', 'sk-test');
  vi.stubEnv('DEEPSEEK_BASE_URL', 'https://mock-deepseek.test/v1');
  vi.stubEnv('RATE_LIMIT_PER_HOUR', '2');
  vi.stubEnv('RATE_LIMIT_MAX_PAYLOAD_BYTES', '1000');
});

describe('POST /api/llm', () => {
  it('rejects payload over byte cap', async () => {
    const big = 'x'.repeat(2000);
    const res = await POST(makeContext({ messages: [{ role: 'user', content: big }] }) as never);
    expect(res.status).toBe(413);
  });

  it('returns 429 after rate limit', async () => {
    mswServer.use(
      http.post('https://mock-deepseek.test/v1/chat/completions', () =>
        HttpResponse.text('data: {"choices":[{"delta":{"content":"hi"}}]}\n\ndata: [DONE]\n\n', {
          headers: { 'content-type': 'text/event-stream' },
        })
      )
    );
    const ok1 = await POST(makeContext({ messages: [{ role: 'user', content: 'a' }] }, '9.9.9.9') as never);
    const ok2 = await POST(makeContext({ messages: [{ role: 'user', content: 'a' }] }, '9.9.9.9') as never);
    const blocked = await POST(makeContext({ messages: [{ role: 'user', content: 'a' }] }, '9.9.9.9') as never);
    expect(ok1.status).toBe(200);
    expect(ok2.status).toBe(200);
    expect(blocked.status).toBe(429);
  });

  it('rejects baseUrl-less BYOK with bad shape', async () => {
    const res = await POST(makeContext({ messages: 'not-array' }) as never);
    expect(res.status).toBe(400);
  });
});
