import { useState } from 'react';
import { TopBar } from './TopBar';
import { SettingsModal } from './SettingsModal';
import { HistoryDrawer } from './HistoryDrawer';
import { FixDrawer } from './FixDrawer';
import { InputTabs } from './LeftPane/InputTabs';
import { StackView } from './MiddlePane/StackView';
import { TicketEditor } from './RightPane/TicketEditor';
import { Actions } from './RightPane/Actions';

export default function Workspace() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [fixOpen, setFixOpen] = useState(false);

  return (
    <div className="flex flex-col h-screen">
      <TopBar
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenHistory={() => setHistoryOpen(true)}
      />
      <main className="flex flex-1 overflow-hidden">
        <section className="w-1/4 min-w-[280px] border-r border-slate-200 dark:border-slate-800 overflow-y-auto">
          <InputTabs />
        </section>
        <section className="flex-1 border-r border-slate-200 dark:border-slate-800 overflow-y-auto">
          <StackView />
        </section>
        <section className="w-[35%] min-w-[320px] overflow-y-auto flex flex-col">
          <div className="flex-1"><TicketEditor /></div>
          <div className="border-t border-slate-200 dark:border-slate-800"><Actions onOpenFix={() => setFixOpen(true)} /></div>
        </section>
      </main>
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
      {historyOpen && <HistoryDrawer onClose={() => setHistoryOpen(false)} />}
      {fixOpen && <FixDrawer onClose={() => setFixOpen(false)} />}
    </div>
  );
}
