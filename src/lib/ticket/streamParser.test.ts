import { describe, it, expect } from 'vitest';
import { createStreamParser } from './streamParser';

describe('createStreamParser', () => {
  it('emits each top-level field once its value parses cleanly', () => {
    const p = createStreamParser();
    const updates: Array<{ field: string; value: unknown }> = [];

    p.feed('{"narrative":"hello",').forEach((u) => updates.push(u));
    expect(updates.map((u) => u.field)).toEqual(['narrative']);
    expect(updates[0].value).toBe('hello');

    p.feed('"title":"NPE in Main",').forEach((u) => updates.push(u));
    expect(updates.map((u) => u.field)).toContain('title');

    p.feed('"labels":["crash","android"],').forEach((u) => updates.push(u));
    expect(updates.find((u) => u.field === 'labels')?.value).toEqual(['crash', 'android']);

    p.feed('"severity":"sev2"}').forEach((u) => updates.push(u));
    const sev = updates.find((u) => u.field === 'severity');
    expect(sev?.value).toBe('sev2');
  });

  it('never emits the same field twice for the same value', () => {
    const p = createStreamParser();
    const all = [...p.feed('{"narrative":"x"}'), ...p.feed('')];
    const narrCount = all.filter((u) => u.field === 'narrative').length;
    expect(narrCount).toBe(1);
  });

  it('survives JSON wrapped in a markdown fence', () => {
    const p = createStreamParser();
    const out = p.feed('```json\n{"narrative":"y"}\n```');
    expect(out.find((u) => u.field === 'narrative')?.value).toBe('y');
  });
});
