import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/server/claudeAgentic', () => ({
  streamFix: vi.fn(async function* () {
    yield { type: 'text', text: 'thinking…' };
  }),
}));

vi.mock('@/server/projectGuard', () => ({
  validateProject: vi.fn(async (p: string) => {
    if (p === '/ok') return { ok: true, path: '/ok' };
    return { ok: false, reason: 'no good' };
  }),
  listBranches: vi.fn(async () => ['main', 'develop']),
}));

import { POST } from './fix';

function ctx(body: unknown, ip = '1.1.1.1') {
  return {
    request: new Request('http://localhost/api/fix', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    }),
    clientAddress: ip,
  };
}

const baseBody = {
  projectPath: '/ok',
  baseBranch: 'main',
  ticket: { title: 't', severity: 'sev2', labels: [], summary: '', suspectedCause: '', reproGuess: '', confidence: 'med' },
  classified: [],
  deobfCrash: { exception: 'X', message: '', frames: [], mappingApplied: false },
};

beforeEach(() => {
  vi.stubEnv('RATE_LIMIT_PER_HOUR', '3');
});

describe('POST /api/fix', () => {
  it('rejects bad payload shape', async () => {
    const r = await POST(ctx({ foo: 'bar' }) as never);
    expect(r.status).toBe(400);
  });

  it('rejects when project guard fails', async () => {
    const r = await POST(ctx({ ...baseBody, projectPath: '/nope' }) as never);
    expect(r.status).toBe(400);
    const j = await r.json();
    expect(j.error).toContain('no good');
  });

  it('rejects when baseBranch missing from project', async () => {
    const r = await POST(ctx({ ...baseBody, baseBranch: 'ghost' }) as never);
    expect(r.status).toBe(400);
    const j = await r.json();
    expect(j.error).toContain('ghost');
  });

  it('returns 200 stream on happy path', async () => {
    const r = await POST(ctx(baseBody, '8.8.8.8') as never);
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toBe('text/event-stream');
  });

  it('429 after rate limit exhausted', async () => {
    const a = await POST(ctx(baseBody, '9.9.9.9') as never);
    const b = await POST(ctx(baseBody, '9.9.9.9') as never);
    const c = await POST(ctx(baseBody, '9.9.9.9') as never);
    const d = await POST(ctx(baseBody, '9.9.9.9') as never);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(c.status).toBe(200);
    expect(d.status).toBe(429);
  });
});
