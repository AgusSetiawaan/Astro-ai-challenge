import type { RawCrash, DeobfCrash, MappingTable, Frame } from '@/types';

function deobfFrame(frame: Frame, table: MappingTable): { frame: Frame; replaced: boolean } {
  const entry = table.get(frame.class);
  if (!entry) return { frame, replaced: false };
  const originalMethod = entry.methods.get(frame.method) ?? frame.method;
  return {
    frame: {
      ...frame,
      class: entry.originalClass,
      method: originalMethod,
      obfuscated: false,
    },
    replaced: true,
  };
}

export function deobfuscate(crash: RawCrash, table: MappingTable): DeobfCrash {
  let anyReplaced = false;
  const newFrames: Frame[] = crash.frames.map((f) => {
    const { frame, replaced } = deobfFrame(f, table);
    if (replaced) anyReplaced = true;
    return frame;
  });
  const cause = crash.cause ? deobfuscate(crash.cause, table) : undefined;
  if (cause?.mappingApplied) anyReplaced = true;
  return { ...crash, frames: newFrames, cause, mappingApplied: anyReplaced };
}
