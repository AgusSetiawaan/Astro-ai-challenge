import ReactMarkdown from 'react-markdown';
import { useApp } from '@/client/store';
import { FrameRow } from './FrameRow';
import { createStreamParser } from '@/lib/ticket/streamParser';
import { useMemo } from 'react';

export function StackView() {
  const phase = useApp((s) => s.phase);
  const classified = useApp((s) => s.classified);
  const buffer = useApp((s) => s.llmStreamBuffer);

  const narrative = useMemo(() => {
    if (!buffer) return '';
    const p = createStreamParser();
    const updates = p.feed(buffer);
    const found = updates.find((u) => u.field === 'narrative');
    return typeof found?.value === 'string' ? found.value : '';
  }, [buffer]);

  if (phase === 'idle') {
    return (
      <div className="p-6 text-sm text-slate-500">
        <p>Paste a crash on the left and click <strong>Analyze</strong>. The deobfuscated stack and an AI narrative will render here.</p>
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
    </div>
  );
}
