import type { TicketDraft } from '@/types';

function esc(s: string): string {
  return s.replace(/`/g, '\\`');
}

export function toMarkdown(d: TicketDraft): string {
  return [
    `# ${d.title}`,
    '',
    `**Severity:** ${d.severity}    **Confidence:** ${d.confidence}`,
    `**Labels:** ${d.labels.join(', ')}`,
    '',
    '## Summary',
    esc(d.summary),
    '',
    '## Suspected Cause',
    esc(d.suspectedCause),
    '',
    '## Repro Guess',
    esc(d.reproGuess),
    '',
    '## AI Confidence',
    d.confidence,
    '',
  ].join('\n');
}
