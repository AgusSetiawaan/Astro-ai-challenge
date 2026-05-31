import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseMapping } from './parser';

const fx = (name: string) =>
  readFileSync(new URL(`../__fixtures__/${name}`, import.meta.url), 'utf8');

describe('parseMapping', () => {
  it('parses R8 mapping with class + method entries', () => {
    const { table, stats } = parseMapping(fx('mapping-r8.txt'));
    expect(stats.classes).toBe(2);
    expect(stats.methods).toBe(3);
    expect(stats.errors).toBe(0);
    const main = table.get('a.b.c');
    expect(main?.originalClass).toBe('com.example.app.MainActivity');
    expect(main?.methods.get('a')).toBe('onCreate');
    expect(main?.methods.get('b')).toBe('onResume');
  });

  it('handles empty mapping', () => {
    const { table, stats } = parseMapping(fx('mapping-empty.txt'));
    expect(table.size).toBe(0);
    expect(stats).toEqual({ classes: 0, methods: 0, errors: 0 });
  });

  it('counts malformed lines as errors and continues', () => {
    const bad = 'com.example.A -> a:\n    bogus line here\n    void m() -> n\n';
    const { stats } = parseMapping(bad);
    expect(stats.errors).toBeGreaterThan(0);
    expect(stats.methods).toBe(1);
  });
});
