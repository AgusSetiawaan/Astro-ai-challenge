import { create } from 'zustand';
import type { CrashFormat, RawCrash, DeobfCrash, ClassifiedFrame, MappingTable, TicketDraft } from '@/types';

export type AppPhase = 'idle' | 'parsing' | 'parsed' | 'analyzing' | 'analyzed' | 'editing' | 'filing' | 'filed' | 'error' | 'jira-error';

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

  setInputs: (patch: Partial<InputsState>) => void;
  setMappingTable: (t: MappingTable) => void;
  setParsed: (p: RawCrash, deobf: DeobfCrash, classified: ClassifiedFrame[]) => void;
  appendLlm: (delta: string) => void;
  patchTicketField: <K extends keyof TicketDraft>(k: K, v: TicketDraft[K], dirty?: boolean) => void;
  setPhase: (phase: AppPhase, errorMessage?: string) => void;
  setJiraResult: (r: { key: string; url?: string }) => void;
  reset: () => void;
}

const blankInputs: InputsState = { stackText: '', mappingText: '', snippetText: '', detectedFormat: 'unknown' };

export const useApp = create<AppState>((set) => ({
  inputs: blankInputs,
  llmStreamBuffer: '',
  dirtyFields: new Set(),
  phase: 'idle',
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
  reset: () => set({
    inputs: blankInputs, parsed: undefined, deobfMap: undefined, deobfCrash: undefined,
    classified: undefined, llmStreamBuffer: '', ticketDraft: undefined,
    dirtyFields: new Set(), phase: 'idle', errorMessage: undefined, jiraResult: undefined,
  }),
}));

function blankDraft(): TicketDraft {
  return {
    title: '', severity: 'sev3', labels: [], summary: '', suspectedCause: '', reproGuess: '', confidence: 'low',
  };
}
