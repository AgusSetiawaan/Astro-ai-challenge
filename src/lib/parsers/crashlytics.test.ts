import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseCrashlytics } from './crashlytics';

const fx = (name: string) =>
  readFileSync(new URL(`../__fixtures__/${name}`, import.meta.url), 'utf8');

describe('parseCrashlytics', () => {
  it('parses a single fatal exception with frames', () => {
    const crash = parseCrashlytics(fx('crashlytics-npe.txt'));
    expect(crash.exception).toBe('java.lang.NullPointerException');
    expect(crash.message).toContain('User.name');
    expect(crash.frames[0]).toMatchObject({
      class: 'com.example.app.MainActivity',
      method: 'onResume',
      file: 'MainActivity.kt',
      line: 88,
      obfuscated: false,
    });
  });

  it('handles multi-cause chain', () => {
    const crash = parseCrashlytics(fx('multi-cause.txt'));
    expect(crash.exception).toBe('java.lang.RuntimeException');
    expect(crash.cause?.exception).toBe('java.io.IOException');
    expect(crash.cause?.cause?.exception).toBe('java.lang.IllegalStateException');
  });
});
