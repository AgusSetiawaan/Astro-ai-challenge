import type { TicketDraft, Severity, Confidence } from '@/types';

export class LlmOutputError extends Error {
  constructor(message: string, public readonly raw: string) {
    super(message);
    this.name = 'LlmOutputError';
  }
}

const SEVERITIES: Severity[] = ['sev1', 'sev2', 'sev3'];
const CONFIDENCES: Confidence[] = ['high', 'med', 'low'];
const REQUIRED = ['title', 'severity', 'labels', 'summary', 'suspectedCause', 'reproGuess', 'confidence'] as const;

function extractJson(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) throw new LlmOutputError('No JSON object found', raw);
  return raw.slice(start, end + 1);
}

export function parseLlmOutput(raw: string): TicketDraft {
  const jsonText = extractJson(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (e) {
    throw new LlmOutputError(`Invalid JSON: ${(e as Error).message}`, raw);
  }
  if (typeof parsed !== 'object' || parsed === null) throw new LlmOutputError('Output is not an object', raw);
  const obj = parsed as Record<string, unknown>;
  for (const key of REQUIRED) {
    if (!(key in obj)) throw new LlmOutputError(`Missing required field "${key}"`, raw);
  }
  if (!SEVERITIES.includes(obj.severity as Severity)) throw new LlmOutputError(`Invalid severity "${String(obj.severity)}"`, raw);
  if (!CONFIDENCES.includes(obj.confidence as Confidence)) throw new LlmOutputError(`Invalid confidence "${String(obj.confidence)}"`, raw);
  if (!Array.isArray(obj.labels) || !obj.labels.every((l) => typeof l === 'string')) {
    throw new LlmOutputError('labels must be string[]', raw);
  }
  return {
    title: String(obj.title),
    severity: obj.severity as Severity,
    labels: obj.labels as string[],
    summary: String(obj.summary),
    suspectedCause: String(obj.suspectedCause),
    reproGuess: String(obj.reproGuess),
    confidence: obj.confidence as Confidence,
  };
}
