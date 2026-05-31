import { describe, it, expect } from 'vitest';
import { toJiraPayload } from './toJiraPayload';
import type { TicketDraft } from '@/types';

const draft: TicketDraft = {
  title: 'NPE in MainActivity', severity: 'sev2', labels: ['crash', 'android'],
  summary: 'desc', suspectedCause: 'null user', reproGuess: 'open app', confidence: 'med',
};

describe('toJiraPayload', () => {
  it('maps severity to Jira priority', () => {
    expect(toJiraPayload(draft, 'ANDROID').fields.priority.name).toBe('High');
    expect(toJiraPayload({ ...draft, severity: 'sev1' }, 'ANDROID').fields.priority.name).toBe('Highest');
    expect(toJiraPayload({ ...draft, severity: 'sev3' }, 'ANDROID').fields.priority.name).toBe('Medium');
  });

  it('uses given project key', () => {
    expect(toJiraPayload(draft, 'ANDROID').fields.project.key).toBe('ANDROID');
  });

  it('description is ADF document with text content', () => {
    const desc = toJiraPayload(draft, 'X').fields.description;
    expect(desc.type).toBe('doc');
    expect(desc.version).toBe(1);
    expect(JSON.stringify(desc)).toContain('null user');
  });

  it('escapes labels with whitespace by replacing spaces with dashes', () => {
    const p = toJiraPayload({ ...draft, labels: ['needs triage', 'A'] }, 'X');
    expect(p.fields.labels).toEqual(['needs-triage', 'A']);
  });
});
