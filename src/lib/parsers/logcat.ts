import type { Frame, RawCrash } from '@/types';

const ANDROID_RUNTIME = /AndroidRuntime:\s*(.*)$/;
const FATAL = /FATAL EXCEPTION:\s*(\S+)/;
const FRAME = /at\s+([\w$.]+)\.([\w$<>]+)\((?:([\w$.]+):(\d+)|(Native Method)|(Unknown Source))\)/;
const EXCEPTION_LINE = /^([\w.$]+(?:Exception|Error))(?::\s*(.*))?$/;
const CAUSED_BY = /^Caused by:\s*([\w.$]+(?:Exception|Error))(?::\s*(.*))?$/;

function stripPrefix(line: string): string {
  const m = line.match(ANDROID_RUNTIME);
  return m ? m[1].trim() : line.trim();
}

function looksObfuscated(name: string): boolean {
  return /(^|\.)[a-z]\.[a-z]$/.test(name) || /(^|\.)[a-z0-9]{1,3}$/.test(name);
}

export function parseLogcat(text: string): RawCrash[] {
  const lines = text.split(/\r?\n/).map(stripPrefix);
  const crashes: RawCrash[] = [];
  let i = 0;

  while (i < lines.length) {
    const fatalMatch = lines[i].match(FATAL);
    if (!fatalMatch) {
      i++;
      continue;
    }
    const thread = fatalMatch[1];
    i++;
    while (i < lines.length && !EXCEPTION_LINE.test(lines[i])) i++;
    if (i >= lines.length) break;

    let current: RawCrash | undefined;
    let root: RawCrash | undefined;

    const exc = lines[i].match(EXCEPTION_LINE)!;
    current = { exception: exc[1], message: exc[2] ?? '', thread, frames: [] };
    root = current;
    i++;

    while (i < lines.length) {
      const frameMatch = lines[i].match(FRAME);
      if (frameMatch) {
        current!.frames.push(frameToObj(frameMatch));
        i++;
        continue;
      }
      const causeMatch = lines[i].match(CAUSED_BY);
      if (causeMatch) {
        const next: RawCrash = {
          exception: causeMatch[1],
          message: causeMatch[2] ?? '',
          frames: [],
        };
        current!.cause = next;
        current = next;
        i++;
        continue;
      }
      break;
    }

    crashes.push(root);
  }
  return crashes;
}

function frameToObj(m: RegExpMatchArray): Frame {
  const cls = m[1];
  const method = m[2];
  const file = m[3];
  const line = m[4] ? Number(m[4]) : undefined;
  return {
    class: cls,
    method,
    file,
    line,
    obfuscated: looksObfuscated(cls) || looksObfuscated(method),
  };
}
