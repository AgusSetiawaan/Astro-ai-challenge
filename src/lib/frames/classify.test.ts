import { describe, it, expect } from 'vitest';
import { classifyFrames } from './classify';
import type { Frame } from '@/types';

const mk = (cls: string, m = 'foo'): Frame => ({ class: cls, method: m, obfuscated: false });

describe('classifyFrames', () => {
  const appPackage = 'com.example.app';

  it('marks app frames first', () => {
    const out = classifyFrames([mk('com.example.app.Main')], appPackage);
    expect(out[0].kind).toBe('app');
  });

  it('marks androidx/android/java/kotlin as framework or os', () => {
    const out = classifyFrames([
      mk('androidx.fragment.Fragment'),
      mk('android.app.Activity'),
      mk('java.lang.Thread'),
      mk('kotlin.coroutines.Foo'),
    ], appPackage);
    expect(out.map((f) => f.kind)).toEqual(['framework', 'os', 'os', 'framework']);
  });

  it('marks coroutine continuation', () => {
    const out = classifyFrames([
      mk('com.example.app.X', 'invokeSuspend'),
      mk('kotlinx.coroutines.DispatchedTask'),
    ], appPackage);
    expect(out[0].kind).toBe('coroutine');
    expect(out[1].kind).toBe('coroutine');
  });

  it('marks .so frames native', () => {
    const out = classifyFrames([mk('libnative.so', 'do_thing')], appPackage);
    expect(out[0].kind).toBe('native');
  });
});
