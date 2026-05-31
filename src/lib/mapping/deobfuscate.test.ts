import { describe, it, expect } from 'vitest';
import { deobfuscate } from './deobfuscate';
import { parseMapping } from './parser';
import type { RawCrash } from '@/types';

const mapping = parseMapping(
  'com.example.app.MainActivity -> a.b.c:\n    void onCreate(android.os.Bundle) -> a\n'
).table;

describe('deobfuscate', () => {
  it('replaces obfuscated class+method', () => {
    const crash: RawCrash = {
      exception: 'NPE',
      message: '',
      frames: [{ class: 'a.b.c', method: 'a', obfuscated: true }],
    };
    const out = deobfuscate(crash, mapping);
    expect(out.mappingApplied).toBe(true);
    expect(out.frames[0]).toMatchObject({
      class: 'com.example.app.MainActivity',
      method: 'onCreate',
      obfuscated: false,
    });
  });

  it('leaves frame untouched if class not in map', () => {
    const crash: RawCrash = {
      exception: 'NPE', message: '',
      frames: [{ class: 'x.y.z', method: 'm', obfuscated: true }],
    };
    const out = deobfuscate(crash, mapping);
    expect(out.mappingApplied).toBe(false);
    expect(out.frames[0].class).toBe('x.y.z');
  });

  it('recurses into cause chain', () => {
    const crash: RawCrash = {
      exception: 'A', message: '', frames: [],
      cause: { exception: 'B', message: '', frames: [{ class: 'a.b.c', method: 'a', obfuscated: true }] },
    };
    const out = deobfuscate(crash, mapping);
    expect(out.cause?.frames[0].class).toBe('com.example.app.MainActivity');
  });
});
