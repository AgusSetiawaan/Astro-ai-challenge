import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '@/client/store';
import { projectStore } from '@/client/projectStore';
import { streamFix, FixHttpError } from '@/client/fixStream';
import { history } from '@/client/history';
import type { FixEvent } from '@/types';

interface BranchInfo {
  branches: string[];
  defaultBranch: string | null;
  current: string;
}

export function FixDrawer({ onClose }: { onClose: () => void }) {
  const ticketDraft = useApp((s) => s.ticketDraft);
  const classified = useApp((s) => s.classified);
  const deobfCrash = useApp((s) => s.deobfCrash);
  const snippet = useApp((s) => s.inputs.snippetText);
  const fixLog = useApp((s) => s.fixLog);
  const fixResult = useApp((s) => s.fixResult);
  const fixError = useApp((s) => s.fixError);
  const phase = useApp((s) => s.phase);
  const startFix = useApp((s) => s.startFix);
  const appendFixEvent = useApp((s) => s.appendFixEvent);
  const setFixResult = useApp((s) => s.setFixResult);
  const setFixError = useApp((s) => s.setFixError);

  const projects = useMemo(() => projectStore.list(), []);
  const [project, setProject] = useState<string>(projects[0] ?? '');
  const [branchInfo, setBranchInfo] = useState<BranchInfo | null>(null);
  const [branchErr, setBranchErr] = useState<string | null>(null);
  const [baseBranch, setBaseBranch] = useState<string>('');
  const [loadingBranches, setLoadingBranches] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!project) { setBranchInfo(null); return; }
    setLoadingBranches(true);
    setBranchErr(null);
    fetch(`/api/project-branches?path=${encodeURIComponent(project)}`)
      .then((r) => r.json().then((body) => ({ ok: r.ok, body })))
      .then(({ ok, body }) => {
        if (!ok) { setBranchErr(body.error ?? 'Failed to list branches'); setBranchInfo(null); return; }
        setBranchInfo(body as BranchInfo);
        setBaseBranch(body.defaultBranch ?? body.current);
      })
      .catch((e) => setBranchErr((e as Error).message))
      .finally(() => setLoadingBranches(false));
  }, [project]);

  async function run() {
    if (!project || !baseBranch || !ticketDraft || !classified || !deobfCrash) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    startFix();
    try {
      for await (const ev of streamFix({
        projectPath: project,
        baseBranch,
        ticket: ticketDraft,
        classified,
        deobfCrash,
        snippet: snippet || undefined,
        signal: ctrl.signal,
      })) {
        appendFixEvent(ev);
        if (ev.type === 'final') {
          setFixResult(ev.result);
          const histId = useApp.getState().currentHistoryId;
          if (histId) history.update(histId, { fixResult: ev.result });
        } else if (ev.type === 'error') {
          setFixError(ev.message);
        }
      }
    } catch (e) {
      if (ctrl.signal.aborted) return;
      setFixError(e instanceof FixHttpError ? `HTTP ${e.status}: ${e.body.slice(0, 200)}` : (e as Error).message);
    }
  }

  function copyCheckout() {
    if (!fixResult || !project) return;
    navigator.clipboard.writeText(`cd ${project} && git checkout ${fixResult.branch}`);
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex justify-end" onClick={() => { abortRef.current?.abort(); onClose(); }}>
      <aside
        className="bg-white dark:bg-slate-900 w-full max-w-2xl h-full shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-semibold">Try Fix</h2>
            <p className="text-xs text-slate-500">Branches off your selected base. Edits only on a new branch. ~$0.20–$1 per attempt, 30s–2min.</p>
          </div>
          <button onClick={() => { abortRef.current?.abort(); onClose(); }} className="px-3 py-1 text-sm rounded border">Close</button>
        </header>

        <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-3 text-sm">
          {projects.length === 0 ? (
            <p className="text-amber-600 text-sm">No projects connected. Open Settings → Connected projects to add one.</p>
          ) : (
            <>
              <label className="block">
                <span className="text-xs uppercase text-slate-500">Project</span>
                <select
                  className="w-full p-2 border rounded"
                  value={project}
                  onChange={(e) => setProject(e.target.value)}
                  disabled={phase === 'fixing'}
                >
                  {projects.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </label>

              <label className="block">
                <span className="text-xs uppercase text-slate-500">Base branch</span>
                <select
                  className="w-full p-2 border rounded"
                  value={baseBranch}
                  onChange={(e) => setBaseBranch(e.target.value)}
                  disabled={!branchInfo || phase === 'fixing'}
                >
                  {branchInfo?.branches.map((b) => (
                    <option key={b} value={b}>
                      {b}{b === branchInfo.defaultBranch ? ' (default)' : ''}{b === branchInfo.current ? ' [current]' : ''}
                    </option>
                  ))}
                </select>
                {loadingBranches && <p className="text-xs text-slate-400 mt-1">Loading branches…</p>}
                {branchErr && <p className="text-xs text-red-600 mt-1">{branchErr}</p>}
              </label>

              <button
                onClick={run}
                disabled={!project || !baseBranch || phase === 'fixing' || !ticketDraft}
                className="px-3 py-2 rounded bg-slate-900 text-white disabled:opacity-40"
              >
                {phase === 'fixing' ? 'Running…' : 'Run'}
              </button>
            </>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2 text-xs">
          {fixLog.length === 0 && phase !== 'fixing' && !fixResult && !fixError && (
            <p className="text-slate-500">Log appears here after you click Run.</p>
          )}
          {phase === 'fixing' && fixLog.length === 0 && (
            <p className="text-purple-500 flex items-center gap-2">
              <span className="inline-block w-3 h-3 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
              Starting <code>claude</code> in <code>{project}</code>… first event in 5–20s.
            </p>
          )}
          {fixLog.map((ev, i) => <FixEventRow key={i} ev={ev} />)}
          {phase === 'fixing' && fixLog.length > 0 && !fixResult && !fixError && (
            <p className="text-purple-500 mt-2 flex items-center gap-2">
              <span className="inline-block w-3 h-3 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
              Working…
            </p>
          )}
          {fixError && (
            <div className="mt-3 p-3 border border-red-300 rounded bg-red-50 dark:bg-red-900/30">
              <p className="text-sm font-medium text-red-700 dark:text-red-300">Fix failed</p>
              <pre className="text-xs whitespace-pre-wrap mt-1">{fixError}</pre>
            </div>
          )}
          {fixResult && (
            <div className="mt-3 p-3 border border-emerald-300 rounded bg-emerald-50 dark:bg-emerald-900/30 space-y-2">
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Fix attempt finished</p>
              <p><strong>Branch:</strong> <code>{fixResult.branch}</code></p>
              <p><strong>Confidence:</strong> {fixResult.confidence}</p>
              <p><strong>Files changed:</strong></p>
              <ul className="list-disc pl-5">{fixResult.filesChanged.map((f) => <li key={f}><code>{f}</code></li>)}</ul>
              <p><strong>What changed:</strong> {fixResult.diffSummary}</p>
              <p><strong>Outcome:</strong> {fixResult.summary}</p>
              <button onClick={copyCheckout} className="px-2 py-1 border rounded">Copy checkout cmd</button>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function FixEventRow({ ev }: { ev: FixEvent }) {
  if (ev.type === 'text') {
    return <p className="whitespace-pre-wrap"><span className="text-slate-400 mr-2">text</span>{ev.text}</p>;
  }
  if (ev.type === 'tool_use') {
    return (
      <p>
        <span className="text-purple-500 mr-2">tool</span>
        <code>{ev.name}</code>
        <span className="text-slate-500 ml-2">{summarizeInput(ev.input)}</span>
      </p>
    );
  }
  if (ev.type === 'tool_result') {
    return (
      <p>
        <span className={`mr-2 ${ev.isError ? 'text-red-500' : 'text-emerald-500'}`}>{ev.isError ? 'tool-err' : 'tool-ok'}</span>
        <code className="text-slate-500">{ev.output.slice(0, 200)}</code>
      </p>
    );
  }
  if (ev.type === 'final') {
    return <p><span className="text-emerald-500 mr-2">done</span>{ev.result.summary}</p>;
  }
  return <p><span className="text-red-500 mr-2">err</span>{ev.message}</p>;
}

function summarizeInput(input: unknown): string {
  if (!input || typeof input !== 'object') return '';
  const i = input as Record<string, unknown>;
  const candidates = ['command', 'pattern', 'path', 'file_path', 'old_string', 'new_string'];
  for (const k of candidates) {
    if (typeof i[k] === 'string') {
      const v = i[k] as string;
      return `${k}=${v.length > 80 ? v.slice(0, 80) + '…' : v}`;
    }
  }
  return JSON.stringify(input).slice(0, 80);
}
