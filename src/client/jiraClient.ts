import type { JiraIssue } from '@/lib/ticket/toJiraPayload';
import type { JiraCreds } from './credStore';

export interface JiraFileResult {
  ok: boolean;
  key?: string;
  url?: string;
  status: number;
  error?: string;
}

export async function fileJiraIssue(creds: JiraCreds, payload: JiraIssue): Promise<JiraFileResult> {
  const res = await fetch('/api/jira', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      baseUrl: creds.baseUrl,
      email: creds.email,
      token: creds.token,
      payload,
    }),
  });

  const text = await res.text();
  let json: { key?: string; self?: string; errorMessages?: string[] } = {};
  try { json = JSON.parse(text); } catch { /* upstream returned non-JSON error */ }

  if (res.status === 201 && json.key) {
    return {
      ok: true,
      key: json.key,
      url: `${creds.baseUrl.replace(/\/$/, '')}/browse/${json.key}`,
      status: 201,
    };
  }
  return {
    ok: false,
    status: res.status,
    error: json.errorMessages?.join('; ') ?? text.slice(0, 300),
  };
}
