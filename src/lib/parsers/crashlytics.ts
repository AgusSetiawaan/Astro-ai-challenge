import type { RawCrash, Frame } from '@/types';

const HEADER = /^(?:Fatal|Non-fatal) Exception:\s*([\w.$]+)(?::\s*(.*))?$/m;
const FRAME = /^\s+at\s+([\w$.]+)\.([\w$<>]+)\((?:([\w$.]+):(\d+)|(Native Method)|(Unknown Source))\)/;
const CAUSED = /^Caused by:\s*([\w.$]+)(?::\s*(.*))?$/;

function looksObfuscated(name: string): boolean {
  return /(^|\.)[a-z]\.[a-z]$/.test(name) || /(^|\.)[a-z0-9]{1,3}$/.test(name);
}

function frameToObj(m: RegExpMatchArray): Frame {
  return {
    class: m[1],
    method: m[2],
    file: m[3],
    line: m[4] ? Number(m[4]) : undefined,
    obfuscated: looksObfuscated(m[1]) || looksObfuscated(m[2]),
  };
}

export function parseCrashlytics(text: string): RawCrash {
  const lines = text.split(/\r?\n/);
  let i = 0;
  while (i < lines.length && !HEADER.test(lines[i])) i++;
  if (i >= lines.length) {
    return { exception: 'Unknown', message: '', frames: [] };
  }
  const header = lines[i].match(HEADER)!;
  const root: RawCrash = { exception: header[1], message: header[2] ?? '', frames: [] };
  let current = root;
  i++;

  while (i < lines.length) {
    const fm = lines[i].match(FRAME);
    if (fm) {
      current.frames.push(frameToObj(fm));
      i++;
      continue;
    }
    const cm = lines[i].match(CAUSED);
    if (cm) {
      const next: RawCrash = { exception: cm[1], message: cm[2] ?? '', frames: [] };
      current.cause = next;
      current = next;
      i++;
      continue;
    }
    i++;
  }
  return root;
}
