import { describe, it, expect } from 'vitest';
import { buildPrompt } from './build';
import type { DeobfCrash, ClassifiedFrame } from '@/types';

const sampleCrash: DeobfCrash = {
  exception: 'java.lang.NullPointerException',
  message: 'name is null',
  frames: [{ class: 'com.example.MainActivity', method: 'onCreate', obfuscated: false }],
  mappingApplied: false,
};
const classified: ClassifiedFrame[] = [
  { class: 'com.example.MainActivity', method: 'onCreate', obfuscated: false, kind: 'app' },
];

describe('buildPrompt', () => {
  it('emits system + user messages', () => {
    const msgs = buildPrompt({ crash: sampleCrash, classified });
    expect(msgs).toHaveLength(2);
    expect(msgs[0].role).toBe('system');
    expect(msgs[1].role).toBe('user');
  });

  it('wraps crash data in tags to mitigate prompt injection', () => {
    const msgs = buildPrompt({ crash: sampleCrash, classified });
    expect(msgs[1].content).toContain('<crash_data>');
    expect(msgs[1].content).toContain('</crash_data>');
  });

  it('includes snippet when provided', () => {
    const msgs = buildPrompt({ crash: sampleCrash, classified, snippet: 'val x = null!!' });
    expect(msgs[1].content).toContain('<source_snippet>');
    expect(msgs[1].content).toContain('val x = null!!');
  });

  it('orders JSON keys narrative, title, severity, labels, summary, suspectedCause, reproGuess, confidence', () => {
    const msgs = buildPrompt({ crash: sampleCrash, classified });
    const sys = msgs[0].content as string;
    const orderIdx = ['narrative', 'title', 'severity', 'labels', 'summary', 'suspectedCause', 'reproGuess', 'confidence']
      .map((k) => sys.indexOf(`"${k}"`));
    for (let i = 1; i < orderIdx.length; i++) expect(orderIdx[i]).toBeGreaterThan(orderIdx[i - 1]);
  });

  it('truncates oversized stacks past budget', () => {
    const huge: DeobfCrash = { ...sampleCrash, frames: Array.from({ length: 500 }, () => sampleCrash.frames[0]) };
    const msgs = buildPrompt({ crash: huge, classified, maxBytes: 2000 });
    expect((msgs[1].content as string).length).toBeLessThanOrEqual(2500);
  });
});
