import { describe, it, expect } from 'vitest';
import { parseLlmOutput, LlmOutputError } from './parseLlmOutput';

const valid = {
  narrative: 'NPE',
  title: 'NPE in MainActivity',
  severity: 'sev2',
  labels: ['crash', 'android'],
  summary: 'desc',
  suspectedCause: 'null user',
  reproGuess: 'open app',
  confidence: 'med',
};

describe('parseLlmOutput', () => {
  it('parses valid JSON', () => {
    const out = parseLlmOutput(JSON.stringify(valid));
    expect(out.title).toBe('NPE in MainActivity');
    expect(out.labels).toEqual(['crash', 'android']);
  });

  it('parses JSON wrapped in markdown fence', () => {
    const out = parseLlmOutput('```json\n' + JSON.stringify(valid) + '\n```');
    expect(out.severity).toBe('sev2');
  });

  it('parses JSON with surrounding prose', () => {
    const out = parseLlmOutput('Here is your ticket:\n' + JSON.stringify(valid) + '\nDone.');
    expect(out.confidence).toBe('med');
  });

  it('throws LlmOutputError on garbage', () => {
    expect(() => parseLlmOutput('not json at all')).toThrow(LlmOutputError);
  });

  it('throws LlmOutputError when required field missing', () => {
    const { title, ...rest } = valid;
    expect(() => parseLlmOutput(JSON.stringify(rest))).toThrow(LlmOutputError);
  });
});
