import { create } from 'zustand';
import type { CrashFormat, RawCrash, DeobfCrash, ClassifiedFrame, MappingTable, TicketDraft, FixResult, FixEvent } from '@/types';

export type AppPhase = 'idle' | 'parsing' | 'parsed' | 'analyzing' | 'analyzed' | 'editing' | 'filing' | 'filed' | 'fixing' | 'fixed' | 'error' | 'jira-error' | 'fix-error';

export interface InputsState {
  stackText: string;
  mappingText: string;
  snippetText: string;
  detectedFormat: CrashFormat;
}

export interface AppState {
  inputs: InputsState;
  parsed?: RawCrash;
  deobfMap?: MappingTable;
  deobfCrash?: DeobfCrash;
  classified?: ClassifiedFrame[];
  llmStreamBuffer: string;
  ticketDraft?: TicketDraft;
  dirtyFields: Set<keyof TicketDraft>;
  phase: AppPhase;
  errorMessage?: string;
  jiraResult?: { key: string; url?: string };
  currentHistoryId?: string;
  fixLog: FixEvent[];
  fixResult?: FixResult;
  fixError?: string;

  setInputs: (patch: Partial<InputsState>) => void;
  setMappingTable: (t: MappingTable) => void;
  setParsed: (p: RawCrash, deobf: DeobfCrash, classified: ClassifiedFrame[]) => void;
  appendLlm: (delta: string) => void;
  patchTicketField: <K extends keyof TicketDraft>(k: K, v: TicketDraft[K], dirty?: boolean) => void;
  setPhase: (phase: AppPhase, errorMessage?: string) => void;
  setJiraResult: (r: { key: string; url?: string }) => void;
  setCurrentHistoryId: (id: string | undefined) => void;
  loadFromHistory: (entry: { stackText: string; snippetText?: string; detectedFormat: import('@/types').CrashFormat; ticketDraft: TicketDraft; jiraResult?: { key: string; url?: string }; fixResult?: FixResult; id: string }) => void;
  appendFixEvent: (ev: FixEvent) => void;
  setFixResult: (r: FixResult) => void;
  startFix: () => void;
  setFixError: (msg: string) => void;
  clearFix: () => void;
  /** Wipe per-analysis state but keep inputs (stack/mapping/snippet) and deobfMap. */
  clearAnalysis: () => void;
  reset: () => void;
}

const blankInputs: InputsState = { stackText: '', mappingText: '', snippetText: '', detectedFormat: 'unknown' };

export const useApp = create<AppState>((set) => ({
  inputs: blankInputs,
  llmStreamBuffer: '',
  dirtyFields: new Set(),
  phase: 'idle',
  fixLog: [],
  setInputs: (patch) => set((s) => ({ inputs: { ...s.inputs, ...patch } })),
  setMappingTable: (t) => set({ deobfMap: t }),
  setParsed: (parsed, deobfCrash, classified) => set({ parsed, deobfCrash, classified, phase: 'parsed' }),
  appendLlm: (delta) => set((s) => ({ llmStreamBuffer: s.llmStreamBuffer + delta })),
  patchTicketField: (k, v, dirty = false) =>
    set((s) => {
      if (s.dirtyFields.has(k) && !dirty) return {};
      const draft = { ...(s.ticketDraft ?? blankDraft()), [k]: v } as TicketDraft;
      const dirtyFields = new Set(s.dirtyFields);
      if (dirty) dirtyFields.add(k);
      return { ticketDraft: draft, dirtyFields };
    }),
  setPhase: (phase, errorMessage) => set({ phase, errorMessage }),
  setJiraResult: (r) => set({ jiraResult: r, phase: 'filed' }),
  setCurrentHistoryId: (id) => set({ currentHistoryId: id }),
  loadFromHistory: (entry) => set({
    inputs: { stackText: entry.stackText, mappingText: '', snippetText: entry.snippetText ?? '', detectedFormat: entry.detectedFormat },
    ticketDraft: entry.ticketDraft,
    jiraResult: entry.jiraResult,
    fixResult: entry.fixResult,
    fixLog: [],
    fixError: undefined,
    currentHistoryId: entry.id,
    parsed: undefined, deobfMap: undefined, deobfCrash: undefined, classified: undefined,
    llmStreamBuffer: '', dirtyFields: new Set(), errorMessage: undefined,
    phase: entry.fixResult ? 'fixed' : entry.jiraResult ? 'filed' : 'analyzed',
  }),
  appendFixEvent: (ev) => set((s) => ({ fixLog: [...s.fixLog, ev] })),
  setFixResult: (r) => set({ fixResult: r, phase: 'fixed', fixError: undefined }),
  startFix: () => set({ fixLog: [], fixResult: undefined, fixError: undefined, phase: 'fixing' }),
  setFixError: (msg) => set({ fixError: msg, phase: 'fix-error' }),
  clearFix: () => set({ fixLog: [], fixResult: undefined, fixError: undefined }),
  clearAnalysis: () => set({
    parsed: undefined, deobfCrash: undefined, classified: undefined,
    llmStreamBuffer: '', ticketDraft: undefined, dirtyFields: new Set(),
    errorMessage: undefined, jiraResult: undefined, currentHistoryId: undefined,
    fixLog: [], fixResult: undefined, fixError: undefined,
    phase: 'idle',
  }),
  reset: () => set({
    inputs: blankInputs, parsed: undefined, deobfMap: undefined, deobfCrash: undefined,
    classified: undefined, llmStreamBuffer: '', ticketDraft: undefined,
    dirtyFields: new Set(), phase: 'idle', errorMessage: undefined, jiraResult: undefined,
    currentHistoryId: undefined, fixLog: [], fixResult: undefined, fixError: undefined,
  }),
}));

function blankDraft(): TicketDraft {
  return {
    title: '', severity: 'sev3', labels: [], summary: '', suspectedCause: '', reproGuess: '', confidence: 'low',
  };
}
