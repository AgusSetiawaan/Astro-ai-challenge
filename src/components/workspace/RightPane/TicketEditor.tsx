import { useApp } from '@/client/store';
import type { Severity } from '@/types';

export function TicketEditor() {
  const draft = useApp((s) => s.ticketDraft);
  const patch = useApp((s) => s.patchTicketField);

  if (!draft) {
    return <div className="p-4 text-sm text-slate-500">Ticket draft appears here after analysis.</div>;
  }

  return (
    <div className="p-3 space-y-3 text-sm">
      <label className="block">
        <span className="text-xs uppercase text-slate-500">Title</span>
        <input
          className="w-full p-2 border rounded"
          value={draft.title}
          onChange={(e) => patch('title', e.target.value, true)}
        />
      </label>

      <div className="flex gap-3">
        <label className="flex-1">
          <span className="text-xs uppercase text-slate-500">Severity</span>
          <select
            className="w-full p-2 border rounded"
            value={draft.severity}
            onChange={(e) => patch('severity', e.target.value as Severity, true)}
          >
            <option value="sev1">sev1 (critical)</option>
            <option value="sev2">sev2 (major)</option>
            <option value="sev3">sev3 (minor)</option>
          </select>
        </label>
        <div className="flex-1">
          <span className="text-xs uppercase text-slate-500">Confidence</span>
          <p className="p-2">{draft.confidence}</p>
        </div>
      </div>

      <label className="block">
        <span className="text-xs uppercase text-slate-500">Labels (comma-separated)</span>
        <input
          className="w-full p-2 border rounded"
          value={draft.labels.join(', ')}
          onChange={(e) =>
            patch('labels', e.target.value.split(',').map((s) => s.trim()).filter(Boolean), true)
          }
        />
      </label>

      <label className="block">
        <span className="text-xs uppercase text-slate-500">Description</span>
        <textarea
          className="w-full p-2 border rounded h-48 font-mono text-xs"
          value={`${draft.summary}\n\n## Suspected Cause\n${draft.suspectedCause}\n\n## Repro Guess\n${draft.reproGuess}`}
          onChange={(e) => patch('summary', e.target.value, true)}
        />
      </label>
    </div>
  );
}
