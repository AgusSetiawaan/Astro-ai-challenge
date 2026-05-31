import { useState } from 'react';
import { StackInput } from './StackInput';
import { MappingDrop } from './MappingDrop';
import { SnippetInput } from './SnippetInput';

type Tab = 'stack' | 'mapping' | 'snippet';

export function InputTabs() {
  const [tab, setTab] = useState<Tab>('stack');
  return (
    <div className="p-3 h-full flex flex-col">
      <nav className="flex gap-1 mb-3 text-sm">
        {(['stack','mapping','snippet'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1 rounded ${tab===t ? 'bg-slate-900 text-white' : 'border'}`}
          >{t}</button>
        ))}
      </nav>
      <div className="flex-1 min-h-0">
        {tab === 'stack' && <StackInput />}
        {tab === 'mapping' && <MappingDrop />}
        {tab === 'snippet' && <SnippetInput />}
      </div>
    </div>
  );
}
