import { useRef, useState } from 'react';
import { useApp } from '@/client/store';
import type { MappingParseStats } from '@/lib/mapping/parser';

const MAX_BYTES = 100 * 1024 * 1024;

export function MappingDrop() {
  const setMappingTable = useApp((s) => s.setMappingTable);
  const setInputs = useApp((s) => s.setInputs);
  const [stats, setStats] = useState<MappingParseStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);

  async function handleFile(file: File) {
    setError(null);
    if (!/\.txt$/i.test(file.name)) { setError('Needs a .txt mapping file'); return; }
    if (file.size > MAX_BYTES) { setError('Mapping too large (>100MB). Use proguard-retrace locally first.'); return; }
    const text = await file.text();
    setInputs({ mappingText: text });
    workerRef.current?.terminate();
    const worker = new Worker(new URL('@/workers/mapping-worker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;
    worker.onmessage = (ev: MessageEvent) => {
      if (ev.data.type === 'parsed') {
        setMappingTable(ev.data.table);
        setStats(ev.data.stats);
      } else if (ev.data.type === 'error') {
        setError(ev.data.message);
      }
    };
    worker.postMessage({ type: 'parse', text });
  }

  return (
    <div className="flex flex-col h-full">
      <input
        type="file"
        accept=".txt"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />
      {stats && (
        <p className="mt-3 text-xs text-slate-500">
          Parsed {stats.classes} classes, {stats.methods} methods, {stats.errors} skipped lines
        </p>
      )}
      {error && <p className="mt-3 text-xs text-red-500">{error}</p>}
      <p className="mt-3 text-xs text-slate-400">mapping.txt is parsed in this browser tab and never uploaded.</p>
    </div>
  );
}
