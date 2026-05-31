import type { Frame, ClassifiedFrame, FrameKind } from '@/types';

const FRAMEWORK_PREFIXES = ['androidx.', 'com.google.android.', 'com.android.', 'dagger.', 'retrofit2.', 'okhttp3.', 'kotlin.', 'kotlinx.serialization'];
const OS_PREFIXES = ['android.', 'java.', 'javax.', 'sun.', 'dalvik.', 'libcore.'];
const COROUTINE_PREFIXES = ['kotlinx.coroutines.', 'kotlin.coroutines.jvm.'];
const COROUTINE_METHODS = new Set(['invokeSuspend', 'resumeWith', 'createStateMachine']);

function startsWithAny(s: string, prefixes: string[]): boolean {
  return prefixes.some((p) => s.startsWith(p));
}

export function classifyFrames(frames: Frame[], appPackage: string): ClassifiedFrame[] {
  return frames.map((f) => ({ ...f, kind: classify(f, appPackage) }));
}

function classify(f: Frame, appPackage: string): FrameKind {
  if (f.class.endsWith('.so')) return 'native';
  if (startsWithAny(f.class, COROUTINE_PREFIXES) || COROUTINE_METHODS.has(f.method)) return 'coroutine';
  if (f.class.startsWith(appPackage)) return 'app';
  if (startsWithAny(f.class, OS_PREFIXES)) return 'os';
  if (startsWithAny(f.class, FRAMEWORK_PREFIXES)) return 'framework';
  return 'framework';
}
