import { describe, it, expect } from 'vitest';
import { parseFixOutput, FixOutputError } from './parseFixOutput';

const valid = {
  branch: 'stacksurgeon/fix-abc',
  filesChanged: ['app/src/main/X.kt'],
  diffSummary: 'Added null guard before User.getName().',
  summary: 'Guarded the NPE in onResume.',
  confidence: 'med',
};

describe('parseFixOutput', () => {
  it('parses valid JSON', () => {
    const out = parseFixOutput(JSON.stringify(valid));
    expect(out.branch).toBe('stacksurgeon/fix-abc');
    expect(out.filesChanged).toEqual(['app/src/main/X.kt']);
    expect(out.confidence).toBe('med');
  });

  it('parses JSON wrapped in markdown fence', () => {
    const out = parseFixOutput('Here you go:\n```json\n' + JSON.stringify(valid) + '\n```\n');
    expect(out.summary).toBe(valid.summary);
  });

  it('parses JSON with surrounding prose', () => {
    const out = parseFixOutput(`Done.\n${JSON.stringify(valid)}\nThanks.`);
    expect(out.confidence).toBe('med');
  });

  it('throws on garbage', () => {
    expect(() => parseFixOutput('not json')).toThrow(FixOutputError);
  });

  it('throws when required field missing', () => {
    const { summary, ...rest } = valid;
    expect(() => parseFixOutput(JSON.stringify(rest))).toThrow(FixOutputError);
  });

  it('throws on invalid confidence', () => {
    expect(() => parseFixOutput(JSON.stringify({ ...valid, confidence: 'wat' }))).toThrow(FixOutputError);
  });

  it('throws on non-string filesChanged entry', () => {
    expect(() => parseFixOutput(JSON.stringify({ ...valid, filesChanged: [1, 2] }))).toThrow(FixOutputError);
  });
});
