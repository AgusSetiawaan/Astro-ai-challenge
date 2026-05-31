import { describe, it, expect } from 'vitest';
import { toMarkdown } from './toMarkdown';
import type { TicketDraft } from '@/types';

const draft: TicketDraft = {
  title: 'NPE in MainActivity', severity: 'sev2', labels: ['crash', 'android'],
  summary: 'A NullPointerException was thrown.',
  suspectedCause: 'User is null in onResume',
  reproGuess: 'Open app cold',
  confidence: 'med',
};

describe('toMarkdown', () => {
  it('renders all fields with stable headings', () => {
    const md = toMarkdown(draft);
    expect(md).toContain('# NPE in MainActivity');
    expect(md).toContain('**Severity:** sev2');
    expect(md).toMatch(/\*\*Labels:\*\* crash, android/);
    expect(md).toContain('## Summary');
    expect(md).toContain('## Suspected Cause');
    expect(md).toContain('## Repro Guess');
    expect(md).toContain('## AI Confidence');
  });

  it('escapes backticks in body fields', () => {
    const md = toMarkdown({ ...draft, suspectedCause: 'see `User.kt`' });
    expect(md).toContain('see \\`User.kt\\`');
  });
});
