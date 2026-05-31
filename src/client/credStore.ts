export interface JiraCreds { baseUrl: string; email: string; token: string; projectKey?: string; }
export interface ByokCreds { deepseekKey?: string; }
export type CredKey = 'jira' | 'byok';
export type Persist = 'local' | 'session';

export interface StorageLike {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

export interface CredStoreOpts {
  persist: Persist;
  storages?: { local: StorageLike; session: StorageLike };
}

export function createCredStore(opts: CredStoreOpts) {
  const stores =
    opts.storages ??
    (typeof window !== 'undefined' ? { local: window.localStorage, session: window.sessionStorage } : null);
  if (!stores) throw new Error('No storage available');

  const writeTo = opts.persist === 'local' ? stores.local : stores.session;
  const clearFrom = [stores.local, stores.session];

  return {
    set<K extends CredKey>(k: K, value: K extends 'jira' ? JiraCreds : ByokCreds) {
      writeTo.setItem(k, JSON.stringify(value));
    },
    get<K extends CredKey>(k: K): (K extends 'jira' ? JiraCreds : ByokCreds) | null {
      const raw = stores.session.getItem(k) ?? stores.local.getItem(k);
      return raw ? (JSON.parse(raw) as never) : null;
    },
    clear(k: CredKey) { clearFrom.forEach((s) => s.removeItem(k)); },
  };
}
