import { useEffect, useMemo, useRef } from 'react';
import { useApp } from '@/client/store';
import { detectFormat } from '@/lib/parsers/detect';
import { parseLogcat } from '@/lib/parsers/logcat';
import { parseCrashlytics } from '@/lib/parsers/crashlytics';
import { parseVitals } from '@/lib/parsers/vitals';
import { deobfuscate } from '@/lib/mapping/deobfuscate';
import { classifyFrames } from '@/lib/frames/classify';
import { buildPrompt } from '@/lib/prompt/build';
import { streamLlm, LlmHttpError } from '@/client/llmStream';
import { createStreamParser } from '@/lib/ticket/streamParser';
import { parseLlmOutput, LlmOutputError } from '@/lib/ticket/parseLlmOutput';
import { createCredStore } from '@/client/credStore';
import { history } from '@/client/history';
import type { RawCrash, TicketDraft } from '@/types';

const APP_PACKAGE = 'com.example.app'; // future: make configurable in Settings

export function StackInput() {
  const stackText = useApp((s) => s.inputs.stackText);
  const setInputs = useApp((s) => s.setInputs);
  const setParsed = useApp((s) => s.setParsed);
  const setPhase = useApp((s) => s.setPhase);
  const appendLlm = useApp((s) => s.appendLlm);
  const patchTicketField = useApp((s) => s.patchTicketField);
  const deobfMap = useApp((s) => s.deobfMap);
  const snippet = useApp((s) => s.inputs.snippetText);

  const abortRef = useRef<AbortController | null>(null);
  const detected = useMemo(() => detectFormat(stackText), [stackText]);

  useEffect(() => { setInputs({ detectedFormat: detected }); }, [detected, setInputs]);

  async function analyze() {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setPhase('parsing');
    let raw: RawCrash;
    if (detected === 'logcat') raw = parseLogcat(stackText)[0] ?? { exception: 'Unknown', message: '', frames: [] };
    else if (detected === 'crashlytics') raw = parseCrashlytics(stackText);
    else if (detected === 'vitals') raw = parseVitals(stackText);
    else raw = parseCrashlytics(stackText);

    const deobf = deobfuscate(raw, deobfMap ?? new Map());
    const classified = classifyFrames(deobf.frames, APP_PACKAGE);
    setParsed(raw, deobf, classified);

    const messages = buildPrompt({ crash: deobf, classified, snippet: snippet || undefined });
    const byok = createCredStore({ persist: 'local' }).get('byok');

    setPhase('analyzing');
    const parser = createStreamParser();

    try {
      let buffer = '';
      for await (const delta of streamLlm({
        messages,
        byokKey: (byok as { deepseekKey?: string } | null)?.deepseekKey,
        signal: ctrl.signal,
      })) {
        buffer += delta;
        appendLlm(delta);
        for (const up of parser.feed(delta)) {
          if (up.field === 'narrative') continue;
          patchTicketField(up.field as keyof TicketDraft, up.value as never);
        }
      }
      let savedDraft: TicketDraft | null = null;
      try {
        const finalDraft = parseLlmOutput(buffer);
        (Object.keys(finalDraft) as (keyof TicketDraft)[]).forEach((k) =>
          patchTicketField(k, finalDraft[k] as never)
        );
        savedDraft = finalDraft;
        setPhase('analyzed');
      } catch (e) {
        if (e instanceof LlmOutputError) {
          patchTicketField('summary', buffer);
          setPhase('analyzed', 'AI output unstructured; review before filing.');
        } else throw e;
      }
      if (savedDraft) {
        const entry = history.add({
          stackText,
          snippetText: snippet || undefined,
          detectedFormat: detected,
          ticketDraft: savedDraft,
        });
        useApp.getState().setCurrentHistoryId(entry.id);
      }
    } catch (e) {
      if (ctrl.signal.aborted) return;
      const msg = e instanceof LlmHttpError ? `LLM error: ${e.status}` : (e as Error).message;
      setPhase('error', msg);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-2 text-xs text-slate-500">
        <span>Format: <strong>{detected}</strong></span>
        <span>{stackText.length} chars</span>
      </div>
      <textarea
        className="flex-1 w-full p-2 border rounded font-mono text-xs resize-none"
        value={stackText}
        onChange={(e) => setInputs({ stackText: e.target.value })}
        placeholder="Paste logcat / Crashlytics / Vitals dump here"
      />
      <button
        disabled={!stackText.trim()}
        onClick={analyze}
        className="mt-3 px-3 py-2 rounded bg-slate-900 text-white disabled:opacity-40"
      >Analyze ▶</button>
    </div>
  );
}
