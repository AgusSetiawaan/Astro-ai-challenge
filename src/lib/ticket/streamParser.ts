import { parse as parsePartial, Allow } from 'partial-json';

export interface FieldUpdate {
  field: string;
  value: unknown;
}

export interface StreamParser {
  feed(chunk: string): FieldUpdate[];
}

function stripFence(s: string): string {
  return s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
}

export function createStreamParser(): StreamParser {
  let buffer = '';
  const lastEmitted = new Map<string, string>();

  return {
    feed(chunk: string) {
      buffer += chunk;
      const cleaned = stripFence(buffer).trim();
      if (!cleaned.startsWith('{')) return [];
      let parsed: Record<string, unknown>;
      try {
        parsed = parsePartial(cleaned, Allow.ALL) as Record<string, unknown>;
      } catch {
        return [];
      }
      const updates: FieldUpdate[] = [];
      for (const [field, value] of Object.entries(parsed)) {
        const serialized = JSON.stringify(value);
        if (lastEmitted.get(field) === serialized) continue;
        lastEmitted.set(field, serialized);
        updates.push({ field, value });
      }
      return updates;
    },
  };
}
