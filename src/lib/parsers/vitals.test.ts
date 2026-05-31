import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseVitals } from './vitals';

const fx = (name: string) =>
  readFileSync(new URL(`../__fixtures__/${name}`, import.meta.url), 'utf8');

describe('parseVitals', () => {
  it('parses native tombstone', () => {
    const c = parseVitals(fx('vitals-native.txt'));
    expect(c.exception).toBe('signal 11 (SIGSEGV)');
    expect(c.message).toContain('SEGV_MAPERR');
    expect(c.frames.length).toBe(3);
    expect(c.frames[0]).toMatchObject({
      class: 'libnative.so',
      method: 'do_thing',
      file: '/data/app/com.example.app/lib/x86/libnative.so',
      obfuscated: false,
    });
  });
});
