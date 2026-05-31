import type { CrashFormat } from '@/types';

export function detectFormat(text: string): CrashFormat {
  const t = text.trim();
  if (!t) return 'unknown';

  if (/^\*{3,}|^Build fingerprint:|signal \d+ \(SIG/m.test(t)) return 'vitals';
  if (/AndroidRuntime: FATAL EXCEPTION|AndroidRuntime: Process:/m.test(t)) return 'logcat';
  if (/^Fatal Exception:|^Non-fatal Exception:/m.test(t)) return 'crashlytics';

  return 'unknown';
}
