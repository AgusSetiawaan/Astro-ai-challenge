import type { TicketDraft, Severity } from '@/types';

const PRIORITY: Record<Severity, string> = { sev1: 'Highest', sev2: 'High', sev3: 'Medium' };

export interface JiraIssue {
  fields: {
    project: { key: string };
    summary: string;
    issuetype: { name: string };
    priority: { name: string };
    labels: string[];
    description: AdfDoc;
  };
}

interface AdfDoc {
  type: 'doc';
  version: 1;
  content: AdfNode[];
}
interface AdfNode {
  type: string;
  content?: AdfNode[];
  text?: string;
  attrs?: Record<string, unknown>;
}

function paragraph(text: string): AdfNode {
  return { type: 'paragraph', content: [{ type: 'text', text }] };
}
function heading(text: string, level = 3): AdfNode {
  return { type: 'heading', attrs: { level }, content: [{ type: 'text', text }] };
}

function buildDescription(d: TicketDraft): AdfDoc {
  return {
    type: 'doc',
    version: 1,
    content: [
      paragraph(d.summary),
      heading('Suspected Cause'),
      paragraph(d.suspectedCause),
      heading('Repro Guess'),
      paragraph(d.reproGuess),
      heading('AI Confidence'),
      paragraph(d.confidence),
    ],
  };
}

function sanitizeLabel(l: string): string {
  return l.trim().replace(/\s+/g, '-');
}

export function toJiraPayload(draft: TicketDraft, projectKey: string): JiraIssue {
  return {
    fields: {
      project: { key: projectKey },
      summary: draft.title.slice(0, 254),
      issuetype: { name: 'Bug' },
      priority: { name: PRIORITY[draft.severity] },
      labels: draft.labels.map(sanitizeLabel),
      description: buildDescription(draft),
    },
  };
}
