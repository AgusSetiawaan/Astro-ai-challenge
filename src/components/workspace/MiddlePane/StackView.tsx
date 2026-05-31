import ReactMarkdown from 'react-markdown';
import { useApp } from '@/client/store';
import { FrameRow } from './FrameRow';
import { createStreamParser } from '@/lib/ticket/streamParser';
import { useMemo } from 'react';

export function StackView() {
  const phase = useApp((s) => s.phase);
  const classified = useApp((s) => s.classified);
  const buffer = useApp((s) => s.llmStreamBuffer);
  const errorMessage = useApp((s) => s.errorMessage);

  const narrative = useMemo(() => {
    if (!buffer) return '';
    const p = createStreamParser();
    const updates = p.feed(buffer);
    const found = updates.find((u) => u.field === 'narrative');
    return typeof found?.value === 'string' ? found.value : '';
  }, [buffer]);

  if (phase === 'idle') {
    return (
      <div className="p-6 text-sm text-slate-500 space-y-3">
        <p>Paste a crash on the left and click <strong>Analyze</strong>.</p>
        <button
          className="px-3 py-1 border rounded text-slate-900 dark:text-slate-100"
          onClick={async () => {
            const [stack, mapping] = await Promise.all([
              fetch('/fixtures/sample-anr.txt').then((r) => r.text()),
              fetch('/fixtures/sample-mapping.txt').then((r) => r.text()),
            ]);
            useApp.getState().setInputs({ stackText: stack, mappingText: mapping });
          }}
        >Try sample crash</button>
      </div>
    );
  }

  return (
    <div>
      {narrative && (
        <section className="p-4 prose prose-sm dark:prose-invert max-w-none">
          <ReactMarkdown>{narrative}</ReactMarkdown>
        </section>
      )}
      <ul className="border-t border-slate-200 dark:border-slate-800">
        {(classified ?? []).map((f, i) => (
          <FrameRow key={`${f.class}.${f.method}.${i}`} frame={f} />
        ))}
      </ul>
      {phase === 'analyzing' && <p className="p-3 text-xs text-slate-400">Streaming…</p>}
      {phase === 'error' && errorMessage && (
        <p className="p-3 text-sm text-red-600">{errorMessage}</p>
      )}
    </div>
  );
}
