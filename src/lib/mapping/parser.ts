import type { MappingTable, MappingEntry } from '@/types';

const CLASS_LINE = /^([\w.$]+)\s*->\s*([\w.$]+):$/;
const METHOD_LINE = /^\s+(?:\d+:\d+:)?(?:[\w.$\[\]<>]+\s+)+([\w$<>]+)\([^)]*\)\s*(?::\d+(?::\d+)?)?\s*->\s*([\w$<>]+)$/;
const FIELD_LINE = /^\s+[\w.$\[\]]+\s+([\w$]+)\s*->\s*([\w$]+)$/;
const COMMENT = /^\s*#/;

export interface MappingParseStats {
  classes: number;
  methods: number;
  errors: number;
}

export interface MappingParseResult {
  table: MappingTable;
  stats: MappingParseStats;
}

export function parseMapping(text: string): MappingParseResult {
  const lines = text.split(/\r?\n/);
  const table: MappingTable = new Map();
  let current: MappingEntry | undefined;
  let classes = 0;
  let methods = 0;
  let errors = 0;

  for (const raw of lines) {
    if (!raw.trim() || COMMENT.test(raw)) continue;

    const cm = raw.match(CLASS_LINE);
    if (cm) {
      current = { originalClass: cm[1], obfuscatedClass: cm[2], methods: new Map() };
      table.set(cm[2], current);
      classes++;
      continue;
    }

    if (!current) {
      errors++;
      continue;
    }

    const mm = raw.match(METHOD_LINE);
    if (mm) {
      current.methods.set(mm[2], mm[1]);
      methods++;
      continue;
    }

    if (FIELD_LINE.test(raw)) continue;

    errors++;
  }

  return { table, stats: { classes, methods, errors } };
}
