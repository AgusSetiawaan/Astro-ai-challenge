import { useState } from 'react';
import { useApp } from '@/client/store';
import { toMarkdown } from '@/lib/ticket/toMarkdown';
import { toJiraPayload } from '@/lib/ticket/toJiraPayload';
import { JiraConfirm } from './JiraConfirm';

export function Actions() {
  const draft = useApp((s) => s.ticketDraft);
  const jiraResult = useApp((s) => s.jiraResult);
  const error = useApp((s) => s.errorMessage);
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (!draft) return null;

  function copyMd() {
    navigator.clipboard.writeText(toMarkdown(draft!));
  }
  function downloadJson() {
    const blob = new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'ticket.json'; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-3 flex flex-col gap-2 text-sm">
      <div className="flex gap-2">
        <button className="flex-1 px-3 py-2 border rounded" onClick={copyMd}>Copy MD</button>
        <button className="flex-1 px-3 py-2 border rounded" onClick={downloadJson}>Download JSON</button>
        <button className="flex-1 px-3 py-2 rounded bg-slate-900 text-white" onClick={() => setConfirmOpen(true)}>File to Jira →</button>
      </div>
      {error && <p className="text-xs text-amber-600">{error}</p>}
      {jiraResult && (
        <p className="text-xs text-emerald-600">
          Filed: {jiraResult.url ? <a href={jiraResult.url} target="_blank" rel="noopener">{jiraResult.key}</a> : jiraResult.key}
        </p>
      )}
      {confirmOpen && (
        <JiraConfirm
          payload={toJiraPayload(draft, draft.labels[0] ?? 'PLACEHOLDER')}
          onClose={() => setConfirmOpen(false)}
        />
      )}
    </div>
  );
}
