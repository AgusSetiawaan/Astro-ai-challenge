import type { RawCrash, Frame } from '@/types';

const SIGNAL = /signal\s+\d+\s+\(SIG\w+\),\s+code\s+\d+\s+\((\w+)\)(?:,\s+fault\s+addr\s+(\S+))?/;
const FRAME = /^\s*#\d+\s+pc\s+[0-9a-fA-F]+\s+(\S+)\s+\(([^+]+)(?:\+\d+)?\)/;

export function parseVitals(text: string): RawCrash {
  const lines = text.split(/\r?\n/);
  const sigLine = lines.find((l) => SIGNAL.test(l)) ?? '';
  const sigMatch = sigLine.match(SIGNAL);
  const exception = sigLine.match(/signal\s+\d+\s+\(SIG\w+\)/)?.[0] ?? 'Native crash';
  const message = sigMatch ? `${sigMatch[1]}${sigMatch[2] ? ` at ${sigMatch[2]}` : ''}` : '';

  const frames: Frame[] = [];
  for (const line of lines) {
    const fm = line.match(FRAME);
    if (!fm) continue;
    const filePath = fm[1];
    const fileName = filePath.split('/').pop() ?? filePath;
    frames.push({
      class: fileName,
      method: fm[2].trim(),
      file: filePath,
      obfuscated: false,
    });
  }
  return { exception, message, frames };
}
