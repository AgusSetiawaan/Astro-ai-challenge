import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseLogcat } from './logcat';

const fx = (name: string) =>
  readFileSync(new URL(`../__fixtures__/${name}`, import.meta.url), 'utf8');

describe('parseLogcat', () => {
  it('extracts a single fatal exception', () => {
    const crashes = parseLogcat(fx('logcat-anr.txt'));
    expect(crashes).toHaveLength(1);
    const c = crashes[0];
    expect(c.exception).toBe('java.lang.NullPointerException');
    expect(c.message).toContain('User.getName');
    expect(c.thread).toBe('main');
    expect(c.frames.length).toBeGreaterThanOrEqual(4);
    expect(c.frames[0]).toMatchObject({
      class: 'com.example.app.MainActivity',
      method: 'onCreate',
      file: 'MainActivity.java',
      line: 42,
      obfuscated: false,
    });
  });

  it('returns empty array on no crashes', () => {
    expect(parseLogcat('random log lines\nfoo\nbar')).toEqual([]);
  });
});
