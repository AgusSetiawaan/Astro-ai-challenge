import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { mswServer } from '@/__test__/integration.setup';
import { POST } from './jira';

function ctx(body: unknown) {
  return {
    request: new Request('http://localhost/api/jira', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    }),
    clientAddress: '0.0.0.0',
  };
}

beforeEach(() => {
  mswServer.use(
    http.post('https://acme.atlassian.net/rest/api/3/issue', () =>
      HttpResponse.json({ id: '10001', key: 'ANDROID-1', self: 'https://acme.atlassian.net/rest/api/3/issue/10001' }, { status: 201 })
    )
  );
});

describe('POST /api/jira', () => {
  it('rejects bad baseUrl', async () => {
    const res = await POST(ctx({
      baseUrl: 'https://evil.com/.atlassian.net',
      email: 'a@b.c', token: 't', payload: { fields: {} },
    }) as never);
    expect(res.status).toBe(400);
  });

  it('rejects host with extra suffix', async () => {
    const res = await POST(ctx({
      baseUrl: 'https://x.atlassian.net.evil.com',
      email: 'a@b.c', token: 't', payload: { fields: {} },
    }) as never);
    expect(res.status).toBe(400);
  });

  it('passes valid baseUrl through and returns 201 body', async () => {
    const res = await POST(ctx({
      baseUrl: 'https://acme.atlassian.net',
      email: 'a@b.c', token: 't', payload: { fields: { summary: 'x' } },
    }) as never);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.key).toBe('ANDROID-1');
  });
});
