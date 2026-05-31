/// <reference lib="webworker" />
import { parseMapping, type MappingParseStats } from '../lib/mapping/parser';
import type { MappingTable } from '../types';

export type InMsg = { type: 'parse'; text: string };
export type OutMsg =
  | { type: 'parsed'; table: MappingTable; stats: MappingParseStats }
  | { type: 'error'; message: string };

export function handleMessage(msg: InMsg | { type: string }): OutMsg | null {
  if (msg.type !== 'parse') return null;
  try {
    const { table, stats } = parseMapping((msg as InMsg).text);
    return { type: 'parsed', table, stats };
  } catch (e) {
    return { type: 'error', message: (e as Error).message };
  }
}

if (typeof self !== 'undefined' && 'onmessage' in self) {
  self.onmessage = (ev: MessageEvent<InMsg>) => {
    const reply = handleMessage(ev.data);
    if (reply) (self as unknown as Worker).postMessage(reply);
  };
}
