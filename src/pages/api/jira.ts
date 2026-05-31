import type { APIRoute } from 'astro';

export const prerender = false;

const HOST_RE = new RegExp(
  `^${(import.meta.env.ALLOWED_JIRA_HOST_REGEX ?? '^[a-z0-9-]+\\.atlassian\\.net$').replace(/^\^|\$$/g, '')}$`,
  'i'
);

interface JiraReq {
  baseUrl: string;
  email: string;
  token: string;
  payload: unknown;
}

function isStringField(v: unknown): v is string { return typeof v === 'string' && v.length > 0; }

function validateBaseUrl(raw: unknown): URL | null {
  if (!isStringField(raw)) return null;
  let u: URL;
  try { u = new URL(raw); } catch { return null; }
  if (u.protocol !== 'https:') return null;
  if (u.pathname !== '/' && u.pathname !== '') return null;
  if (u.port !== '' && u.port !== '443') return null;
  if (!HOST_RE.test(u.hostname)) return null;
  return u;
}

export const POST: APIRoute = async ({ request }) => {
  let body: JiraReq;
  try { body = await request.json(); } catch { return new Response('Invalid JSON', { status: 400 }); }

  const base = validateBaseUrl(body.baseUrl);
  if (!base) return new Response('baseUrl must match *.atlassian.net', { status: 400 });
  if (!isStringField(body.email) || !isStringField(body.token)) return new Response('Missing credentials', { status: 400 });
  if (typeof body.payload !== 'object' || body.payload === null) return new Response('Missing payload', { status: 400 });

  const auth = `Basic ${Buffer.from(`${body.email}:${body.token}`).toString('base64')}`;
  const upstream = await fetch(`${base.origin}/rest/api/3/issue`, {
    method: 'POST',
    headers: {
      authorization: auth,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify(body.payload),
  });

  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: { 'content-type': upstream.headers.get('content-type') ?? 'application/json' },
  });
};
