import { useEffect, useState } from 'react';
import { useApp } from '@/client/store';
import { history, type HistoryEntry } from '@/client/history';
import { createCredStore, type JiraCreds } from '@/client/credStore';
import { fileJiraIssue } from '@/client/jiraClient';
import { toMarkdown } from '@/lib/ticket/toMarkdown';
import { toJiraPayload } from '@/lib/ticket/toJiraPayload';

function formatTime(ms: number): string {
  const d = new Date(ms);
  const today = new Date();
  const sameDay =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  return sameDay
    ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function getCreds(): JiraCreds | null {
  const a = createCredStore({ persist: 'local' }).get('jira') as JiraCreds | null;
  if (a) return a;
  const b = createCredStore({ persist: 'session' }).get('jira') as JiraCreds | null;
  return b;
}

export function HistoryDrawer({ onClose }: { onClose: () => void }) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [filingId, setFilingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loadFromHistory = useApp((s) => s.loadFromHistory);

  function refresh() { setEntries(history.list()); }
  useEffect(() => { refresh(); }, []);

  function copyMd(e: HistoryEntry) {
    navigator.clipboard.writeText(toMarkdown(e.ticketDraft));
  }

  function downloadJson(e: HistoryEntry) {
    const blob = new Blob([JSON.stringify(e, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ticket-${e.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function fileToJira(e: HistoryEntry) {
    setError(null);
    const creds = getCreds();
    if (!creds) { setError('Configure Jira credentials in Settings first.'); return; }
    setFilingId(e.id);
    const payload = toJiraPayload(e.ticketDraft, creds.projectKey || e.ticketDraft.labels[0] || 'PLACEHOLDER');
    const result = await fileJiraIssue(creds, payload);
    setFilingId(null);
    if (result.ok && result.key) {
      history.update(e.id, { jiraResult: { key: result.key, url: result.url } });
      refresh();
    } else {
      setError(result.error ?? `HTTP ${result.status}`);
    }
  }

  function loadEntry(e: HistoryEntry) {
    loadFromHistory({
      id: e.id,
      stackText: e.stackText,
      snippetText: e.snippetText,
      detectedFormat: e.detectedFormat,
      ticketDraft: e.ticketDraft,
      jiraResult: e.jiraResult,
    });
    onClose();
  }

  function deleteEntry(e: HistoryEntry) {
    if (!confirm(`Delete "${e.ticketDraft.title}"?`)) return;
    history.remove(e.id);
    refresh();
  }

  function clearAll() {
    if (!confirm(`Delete all ${entries.length} history entries?`)) return;
    history.clear();
    refresh();
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex justify-end" onClick={onClose}>
      <aside
        className="bg-white dark:bg-slate-900 w-full max-w-xl h-full shadow-2xl flex flex-col"
        onClick={(ev) => ev.stopPropagation()}
      >
        <header className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-lg font-semibold">History ({entries.length})</h2>
          <div className="flex gap-2">
            {entries.length > 0 && (
              <button onClick={clearAll} className="px-3 py-1 text-xs rounded border text-red-600">Clear all</button>
            )}
            <button onClick={onClose} className="px-3 py-1 text-sm rounded border">Close</button>
          </div>
        </header>

        {error && <p className="px-4 py-2 text-sm text-red-600 border-b border-red-200">{error}</p>}

        <div className="flex-1 overflow-y-auto">
          {entries.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">No history yet. Successful analyses get saved here automatically.</p>
          ) : (
            <ul className="divide-y divide-slate-200 dark:divide-slate-800">
              {entries.map((e) => (
                <li key={e.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{e.ticketDraft.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        <span className="uppercase mr-2">{e.ticketDraft.severity}</span>
                        <span className="mr-2">{formatTime(e.createdAt)}</span>
                        <span>{e.detectedFormat}</span>
                      </p>
                      {e.ticketDraft.labels.length > 0 && (
                        <p className="text-xs text-slate-400 mt-1 truncate">{e.ticketDraft.labels.join(', ')}</p>
                      )}
                      {e.jiraResult && (
                        <p className="text-xs text-emerald-600 mt-1">
                          Filed:{' '}
                          {e.jiraResult.url
                            ? <a href={e.jiraResult.url} target="_blank" rel="noopener" className="underline">{e.jiraResult.key}</a>
                            : e.jiraResult.key}
                        </p>
                      )}
                      {e.fixResult && (
                        <p className="text-xs text-purple-600 mt-1">
                          Fix attempt: <code>{e.fixResult.branch}</code> ({e.fixResult.confidence})
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => deleteEntry(e)}
                      className="text-xs text-slate-400 hover:text-red-600 shrink-0"
                      aria-label="Delete entry"
                    >×</button>
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs">
                    <button onClick={() => loadEntry(e)} className="px-2 py-1 border rounded">Load</button>
                    <button onClick={() => copyMd(e)} className="px-2 py-1 border rounded">Copy MD</button>
                    <button onClick={() => downloadJson(e)} className="px-2 py-1 border rounded">Download JSON</button>
                    <button
                      onClick={() => fileToJira(e)}
                      disabled={filingId === e.id || !!e.jiraResult}
                      className="px-2 py-1 rounded bg-slate-900 text-white disabled:opacity-40"
                    >
                      {filingId === e.id ? 'Filing…' : e.jiraResult ? 'Filed ✓' : 'File to Jira'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}
