import { useState } from 'react';
import { useApp } from '@/client/store';
import { createCredStore } from '@/client/credStore';
import { fileJiraIssue } from '@/client/jiraClient';
import { history } from '@/client/history';
import type { JiraIssue } from '@/lib/ticket/toJiraPayload';

export function JiraConfirm({ payload, onClose }: { payload: JiraIssue; onClose: () => void }) {
  const setPhase = useApp((s) => s.setPhase);
  const setJiraResult = useApp((s) => s.setJiraResult);
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const creds = (createCredStore({ persist: 'local' }).get('jira') ?? createCredStore({ persist: 'session' }).get('jira')) as
    | { baseUrl: string; email: string; token: string; projectKey?: string }
    | null;

  async function submit() {
    if (!creds) { setErr('Open Settings and add Jira credentials first.'); return; }
    setPending(true);
    setPhase('filing');
    const finalPayload: JiraIssue = {
      fields: { ...payload.fields, project: { key: creds.projectKey || payload.fields.project.key } },
    };
    const result = await fileJiraIssue(creds, finalPayload);
    setPending(false);
    if (result.ok && result.key) {
      setJiraResult({ key: result.key, url: result.url });
      const histId = useApp.getState().currentHistoryId;
      if (histId) history.update(histId, { jiraResult: { key: result.key, url: result.url } });
      onClose();
    } else {
      setErr(result.error ?? `HTTP ${result.status}`);
      setPhase('jira-error', result.error ?? `HTTP ${result.status}`);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded shadow-lg p-6 w-[640px] max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-3">Confirm Jira ticket</h2>
        <pre className="text-xs bg-slate-50 dark:bg-slate-800 p-3 rounded overflow-x-auto">{JSON.stringify(payload, null, 2)}</pre>
        {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-3 py-1 rounded border">Cancel</button>
          <button onClick={submit} disabled={pending} className="px-3 py-1 rounded bg-slate-900 text-white disabled:opacity-40">
            {pending ? 'Filing…' : 'File'}
          </button>
        </div>
      </div>
    </div>
  );
}
