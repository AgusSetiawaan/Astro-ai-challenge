import { useEffect, useState } from 'react';
import { createCredStore, type JiraCreds, type ByokCreds, type Persist } from '@/client/credStore';

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const [persist, setPersist] = useState<Persist>('local');
  const [jira, setJira] = useState<JiraCreds>({ baseUrl: '', email: '', token: '', projectKey: '' });
  const [byok, setByok] = useState<ByokCreds>({ deepseekKey: '' });

  useEffect(() => {
    const store = createCredStore({ persist });
    const existingJira = store.get('jira');
    const existingByok = store.get('byok');
    if (existingJira) setJira(existingJira as JiraCreds);
    if (existingByok) setByok(existingByok as ByokCreds);
  }, [persist]);

  function save() {
    const store = createCredStore({ persist });
    store.set('jira', jira);
    store.set('byok', byok);
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-900 rounded shadow-lg p-6 w-[480px]"
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
          <legend className="font-medium mb-1">DeepSeek BYOK (optional, bypasses rate limit)</legend>
          <input className="w-full p-2 border rounded" type="password" placeholder="sk-..." value={byok.deepseekKey ?? ''} onChange={(e) => setByok({ deepseekKey: e.target.value })} />
        </fieldset>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1 rounded border">Cancel</button>
          <button onClick={save} className="px-3 py-1 rounded bg-slate-900 text-white">Save</button>
        </div>
      </div>
    </div>
  );
}
