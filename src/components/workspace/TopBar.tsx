import { useEffect, useState } from 'react';
import { useApp } from '@/client/store';
import { history } from '@/client/history';

export function TopBar({
  onOpenSettings,
  onOpenHistory,
}: {
  onOpenSettings: () => void;
  onOpenHistory: () => void;
}) {
  const phase = useApp((s) => s.phase);
  const [count, setCount] = useState(0);

  // Refresh badge count whenever the analyze pipeline transitions through phases
  // that may have appended a history entry, or on initial mount.
  useEffect(() => { setCount(history.list().length); }, [phase]);

  return (
    <header className="flex items-center gap-4 px-4 py-2 border-b border-slate-200 dark:border-slate-800">
      <h1 className="font-semibold text-lg">StackSurgeon</h1>
      <span className="text-xs uppercase tracking-wider text-slate-500">phase: {phase}</span>
      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={onOpenHistory}
          className="px-3 py-1 text-sm rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          History{count > 0 && <span className="ml-1 text-xs text-slate-500">({count})</span>}
        </button>
        <button
          onClick={onOpenSettings}
          className="px-3 py-1 text-sm rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          Settings
        </button>
      </div>
    </header>
  );
}
