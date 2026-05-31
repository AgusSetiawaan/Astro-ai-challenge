import { describe, it, expect, beforeEach } from 'vitest';
import { createCredStore } from './credStore';

class MemStore {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
  get length() { return this.m.size; }
  key(i: number) { return Array.from(this.m.keys())[i] ?? null; }
}

describe('createCredStore', () => {
  let local: MemStore, session: MemStore;
  beforeEach(() => { local = new MemStore(); session = new MemStore(); });

  it('persists in localStorage by default', () => {
    const s = createCredStore({ persist: 'local', storages: { local, session } });
    s.set('jira', { baseUrl: 'https://x.atlassian.net', email: 'a@b.c', token: 't' });
    expect(JSON.parse(local.getItem('jira')!).email).toBe('a@b.c');
    expect(session.getItem('jira')).toBeNull();
  });

  it('writes only to sessionStorage when persist=session', () => {
    const s = createCredStore({ persist: 'session', storages: { local, session } });
    s.set('jira', { baseUrl: 'https://x.atlassian.net', email: 'a@b.c', token: 't' });
    expect(local.getItem('jira')).toBeNull();
    expect(JSON.parse(session.getItem('jira')!).email).toBe('a@b.c');
  });

  it('clear removes from both stores', () => {
    local.setItem('jira', '{}'); session.setItem('jira', '{}');
    const s = createCredStore({ persist: 'local', storages: { local, session } });
    s.clear('jira');
    expect(local.getItem('jira')).toBeNull();
    expect(session.getItem('jira')).toBeNull();
  });
});
