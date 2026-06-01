const KEY = 'stacksurgeon.projects';
const subs = new Set<() => void>();

function read(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function write(paths: string[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(KEY, JSON.stringify(Array.from(new Set(paths))));
  for (const fn of subs) fn();
}

export const projectStore = {
  list(): string[] {
    return read().sort();
  },
  add(path: string): void {
    write([...read(), path]);
  },
  remove(path: string): void {
    write(read().filter((p) => p !== path));
  },
  clear(): void {
    if (typeof window !== 'undefined') window.localStorage.removeItem(KEY);
    for (const fn of subs) fn();
  },
  /** Subscribe to add/remove/clear events. Returns unsubscribe fn. */
  subscribe(fn: () => void): () => void {
    subs.add(fn);
    return () => subs.delete(fn);
  },
};
