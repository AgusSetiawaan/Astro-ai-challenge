import type { ClassifiedFrame } from '@/types';

const KIND_STYLE: Record<ClassifiedFrame['kind'], string> = {
  app: 'bg-amber-50 dark:bg-amber-900/30 font-medium',
  framework: 'text-slate-500',
  os: 'text-slate-400',
  coroutine: 'text-purple-500',
  native: 'text-emerald-600',
};

export function FrameRow({ frame }: { frame: ClassifiedFrame }) {
  return (
    <li className={`px-3 py-1 text-xs font-mono border-b border-slate-100 dark:border-slate-800 ${KIND_STYLE[frame.kind]}`}>
      <span className="uppercase text-[10px] mr-2 opacity-60">{frame.kind}</span>
      {frame.class}.{frame.method}
      {frame.file ? ` (${frame.file}${frame.line ? `:${frame.line}` : ''})` : ''}
    </li>
  );
}
