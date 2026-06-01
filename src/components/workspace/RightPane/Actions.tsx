import { useEffect, useState } from 'react';
import { useApp } from '@/client/store';
import { toMarkdown } from '@/lib/ticket/toMarkdown';
import { toJiraPayload } from '@/lib/ticket/toJiraPayload';
import { projectStore } from '@/client/projectStore';
import { JiraConfirm } from './JiraConfirm';

export function Actions({ onOpenFix }: { onOpenFix: () => void }) {
  const draft = useApp((s) => s.ticketDraft);
  const jiraResult = useApp((s) => s.jiraResult);
  const fixResult = useApp((s) => s.fixResult);
  const error = useApp((s) => s.errorMessage);
  const phase = useApp((s) => s.phase);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [hasProjects, setHasProjects] = useState(false);

  useEffect(() => { setHasProjects(projectStore.list().length > 0); }, []);

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

  const fixDisabled = !hasProjects || phase === 'fixing';
  const fixTitle = !hasProjects
    ? 'Add a project in Settings → Connected projects first.'
    : phase === 'fixing'
      ? 'Fix already running…'
      : 'Open Try Fix';

  return (
    <div className="p-3 flex flex-col gap-2 text-sm">
      <div className="flex gap-2">
        <button className="flex-1 px-3 py-2 border rounded" onClick={copyMd}>Copy MD</button>
        <button className="flex-1 px-3 py-2 border rounded" onClick={downloadJson}>Download JSON</button>
        <button className="flex-1 px-3 py-2 rounded bg-slate-900 text-white" onClick={() => setConfirmOpen(true)}>File to Jira →</button>
      </div>
      <button
        onClick={onOpenFix}
        disabled={fixDisabled}
        title={fixTitle}
        className="px-3 py-2 rounded border-2 border-purple-500 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/30 disabled:opacity-40"
      >Try Fix in connected project ⚙</button>

      {error && <p className="text-xs text-amber-600">{error}</p>}
      {jiraResult && (
        <p className="text-xs text-emerald-600">
          Filed: {jiraResult.url ? <a href={jiraResult.url} target="_blank" rel="noopener">{jiraResult.key}</a> : jiraResult.key}
        </p>
      )}
      {fixResult && (
        <p className="text-xs text-purple-600">
          Fix attempt on <code>{fixResult.branch}</code> ({fixResult.confidence})
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
