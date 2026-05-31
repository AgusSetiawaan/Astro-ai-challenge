import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { detectFormat } from './detect';

const fx = (name: string) =>
  readFileSync(new URL(`../__fixtures__/${name}`, import.meta.url), 'utf8');

describe('detectFormat', () => {
  it('detects logcat by AndroidRuntime header', () => {
    expect(detectFormat(fx('logcat-anr.txt'))).toBe('logcat');
  });
  it('detects crashlytics by "Fatal Exception:" header', () => {
    expect(detectFormat(fx('crashlytics-npe.txt'))).toBe('crashlytics');
  });
  it('detects vitals by tombstone marker', () => {
    expect(detectFormat(fx('vitals-native.txt'))).toBe('vitals');
  });
  it('returns unknown for garbage', () => {
    expect(detectFormat('hello world')).toBe('unknown');
  });
  it('returns unknown for empty', () => {
    expect(detectFormat('')).toBe('unknown');
  });
});
