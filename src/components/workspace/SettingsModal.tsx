import { useEffect, useState } from 'react';
import { createCredStore, type JiraCreds, type Persist } from '@/client/credStore';
import { projectStore } from '@/client/projectStore';

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const [persist, setPersist] = useState<Persist>('local');
  const [jira, setJira] = useState<JiraCreds>({ baseUrl: '', email: '', token: '', projectKey: '' });

  const [projects, setProjects] = useState<string[]>([]);
  const [newPath, setNewPath] = useState('');
  const [pathError, setPathError] = useState<string | null>(null);
  const [scanCandidates, setScanCandidates] = useState<string[] | null>(null);
  const [scanLoading, setScanLoading] = useState(false);

  useEffect(() => {
    const store = createCredStore({ persist });
    const existing = store.get('jira');
    if (existing) setJira(existing as JiraCreds);
    setProjects(projectStore.list());
  }, [persist]);

  function save() {
    const store = createCredStore({ persist });
    store.set('jira', jira);
    onClose();
  }

  function addPath(path: string) {
    setPathError(null);
    const trimmed = path.trim();
    if (!trimmed) return;
    if (!trimmed.startsWith('/')) { setPathError('Path must be absolute (start with /)'); return; }
    projectStore.add(trimmed);
    setProjects(projectStore.list());
    setNewPath('');
  }

  function removePath(p: string) {
    projectStore.remove(p);
    setProjects(projectStore.list());
  }

  async function findProjects() {
    setScanLoading(true);
    try {
      const res = await fetch('/api/scan-projects');
      const body = await res.json();
      if (Array.isArray(body.candidates)) setScanCandidates(body.candidates);
    } finally {
      setScanLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-900 rounded shadow-lg p-6 w-[560px] max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold mb-4">Settings</h2>

        <fieldset className="mb-4">
          <legend className="font-medium mb-1">Storage</legend>
          <label className="mr-4"><input type="radio" checked={persist === 'local'} onChange={() => setPersist('local')} /> Local (persists)</label>
          <label><input type="radio" checked={persist === 'session'} onChange={() => setPersist('session')} /> Session only</label>
        </fieldset>

        <fieldset className="mb-4">
          <legend className="font-medium mb-1">Jira Cloud</legend>
          <input className="w-full mb-2 p-2 border rounded" placeholder="https://acme.atlassian.net" value={jira.baseUrl} onChange={(e) => setJira({ ...jira, baseUrl: e.target.value })} />
          <input className="w-full mb-2 p-2 border rounded" placeholder="email@example.com" value={jira.email} onChange={(e) => setJira({ ...jira, email: e.target.value })} />
          <input className="w-full mb-2 p-2 border rounded" type="password" placeholder="API token" value={jira.token} onChange={(e) => setJira({ ...jira, token: e.target.value })} />
          <input className="w-full p-2 border rounded" placeholder="Project key (e.g. ANDROID)" value={jira.projectKey ?? ''} onChange={(e) => setJira({ ...jira, projectKey: e.target.value })} />
        </fieldset>

        <fieldset className="mb-4">
          <legend className="font-medium mb-1">Connected projects (for Try Fix)</legend>
          <p className="text-xs text-slate-500 mb-2">
            Absolute paths to local Android repos. StackSurgeon shells out to <code>claude</code> in
            these directories when you click Try Fix. Working tree must be clean.
          </p>

          {projects.length === 0 ? (
            <p className="text-xs text-slate-500 mb-2">No projects connected yet.</p>
          ) : (
            <ul className="mb-2 divide-y divide-slate-200 dark:divide-slate-800 border rounded">
              {projects.map((p) => (
                <li key={p} className="flex items-center justify-between px-2 py-1 text-xs">
                  <code className="truncate">{p}</code>
                  <button onClick={() => removePath(p)} className="ml-2 text-slate-400 hover:text-red-600 shrink-0">×</button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex gap-2 mb-2">
            <input
              className="flex-1 p-2 border rounded text-xs"
              placeholder="/Users/you/AndroidStudioProjects/MyApp"
              value={newPath}
              onChange={(e) => setNewPath(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addPath(newPath); }}
            />
            <button onClick={() => addPath(newPath)} className="px-3 py-1 text-xs border rounded">Add</button>
          </div>
          {pathError && <p className="text-xs text-red-600 mb-2">{pathError}</p>}

          <button onClick={findProjects} disabled={scanLoading} className="px-3 py-1 text-xs border rounded disabled:opacity-40">
            {scanLoading ? 'Scanning…' : 'Find Android projects'}
          </button>

          {scanCandidates && (
            <div className="mt-2 border rounded p-2 max-h-40 overflow-y-auto">
              {scanCandidates.length === 0 ? (
                <p className="text-xs text-slate-500">No candidates found under ~/AndroidStudioProjects, ~/dev, ~/src, ~/code, ~/Projects.</p>
              ) : (
                <ul className="text-xs space-y-1">
                  {scanCandidates.map((c) => (
                    <li key={c} className="flex items-center justify-between">
                      <code className="truncate">{c}</code>
                      <button
                        onClick={() => addPath(c)}
                        disabled={projects.includes(c)}
                        className="ml-2 px-2 py-0.5 border rounded disabled:opacity-40"
                      >{projects.includes(c) ? 'Added' : 'Add'}</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </fieldset>

        <fieldset className="mb-4 opacity-60">
          <legend className="font-medium mb-1">LLM backend</legend>
          <p className="text-xs">Uses your local <code>claude</code> CLI login (Max plan, Pro, or API key). No key to enter here — run <code>claude login</code> in a terminal if Analyze 500s.</p>
        </fieldset>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1 rounded border">Cancel</button>
          <button onClick={save} className="px-3 py-1 rounded bg-slate-900 text-white">Save</button>
        </div>
      </div>
    </div>
  );
}
