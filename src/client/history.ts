import type { TicketDraft, CrashFormat, FixResult } from '@/types';

export interface HistoryEntry {
  id: string;
  createdAt: number;
  stackText: string;
  snippetText?: string;
  detectedFormat: CrashFormat;
  ticketDraft: TicketDraft;
  jiraResult?: { key: string; url?: string };
  fixResult?: FixResult;
}

const STORAGE_KEY = 'stacksurgeon.history';
const MAX_ENTRIES = 50;

function read(): HistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(entries: HistoryEntry[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
}

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export const history = {
  list(): HistoryEntry[] {
    return read().sort((a, b) => b.createdAt - a.createdAt);
  },

  add(entry: Omit<HistoryEntry, 'id' | 'createdAt'>): HistoryEntry {
    const full: HistoryEntry = { id: uid(), createdAt: Date.now(), ...entry };
    write([full, ...read()]);
    return full;
  },

  update(id: string, patch: Partial<Omit<HistoryEntry, 'id' | 'createdAt'>>): void {
    write(read().map((e) => (e.id === id ? { ...e, ...patch } : e)));
  },

  remove(id: string): void {
    write(read().filter((e) => e.id !== id));
  },

  clear(): void {
    if (typeof window !== 'undefined') window.localStorage.removeItem(STORAGE_KEY);
  },
};
