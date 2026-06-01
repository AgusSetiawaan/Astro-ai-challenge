import type { FixResult, Confidence } from '@/types';

export class FixOutputError extends Error {
  constructor(message: string, public readonly raw: string) {
    super(message);
    this.name = 'FixOutputError';
  }
}

const CONFIDENCES: Confidence[] = ['high', 'med', 'low'];
const REQUIRED = ['branch', 'filesChanged', 'diffSummary', 'summary', 'confidence'] as const;

function extractJson(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) throw new FixOutputError('No JSON object found', raw);
  return raw.slice(start, end + 1);
}

export function parseFixOutput(raw: string): FixResult {
  const jsonText = extractJson(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (e) {
    throw new FixOutputError(`Invalid JSON: ${(e as Error).message}`, raw);
  }
  if (typeof parsed !== 'object' || parsed === null) throw new FixOutputError('Output is not an object', raw);
  const obj = parsed as Record<string, unknown>;
  for (const key of REQUIRED) {
    if (!(key in obj)) throw new FixOutputError(`Missing required field "${key}"`, raw);
  }
  if (!CONFIDENCES.includes(obj.confidence as Confidence)) {
    throw new FixOutputError(`Invalid confidence "${String(obj.confidence)}"`, raw);
  }
  if (!Array.isArray(obj.filesChanged) || !obj.filesChanged.every((x) => typeof x === 'string')) {
    throw new FixOutputError('filesChanged must be string[]', raw);
  }
  return {
    branch: String(obj.branch),
    filesChanged: obj.filesChanged as string[],
    diffSummary: String(obj.diffSummary),
    summary: String(obj.summary),
    confidence: obj.confidence as Confidence,
  };
}
