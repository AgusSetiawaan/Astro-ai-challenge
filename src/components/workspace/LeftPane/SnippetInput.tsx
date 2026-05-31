import { useApp } from '@/client/store';

export function SnippetInput() {
  const text = useApp((s) => s.inputs.snippetText);
  const setInputs = useApp((s) => s.setInputs);
  return (
    <div className="flex flex-col h-full">
      <textarea
        className="flex-1 w-full p-2 border rounded font-mono text-xs resize-none"
        value={text}
        onChange={(e) => setInputs({ snippetText: e.target.value })}
        placeholder="Optional: paste the function/file the top app frame points to"
      />
    </div>
  );
}
