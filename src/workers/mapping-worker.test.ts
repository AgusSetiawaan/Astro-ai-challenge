import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { handleMessage } from './mapping-worker';

const fx = (name: string) =>
  readFileSync(new URL(`../lib/__fixtures__/${name}`, import.meta.url), 'utf8');

describe('mapping-worker handleMessage', () => {
  it('parses on {type:"parse"} and returns {type:"parsed", table, stats}', () => {
    const reply = handleMessage({ type: 'parse', text: fx('mapping-r8.txt') });
    expect(reply.type).toBe('parsed');
    if (reply.type !== 'parsed') throw new Error('wrong type');
    expect(reply.stats.classes).toBe(2);
    expect(reply.table.get('a.b.c')?.originalClass).toBe('com.example.app.MainActivity');
  });

  it('ignores unknown message types', () => {
    expect(handleMessage({ type: 'nope' } as never)).toBeNull();
  });
});
