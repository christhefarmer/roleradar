// App shell. Desktop renders the three-column cockpit (sidebar → main →
// assistant rail); ≤820px viewports and PWA launches (?source=pwa) open
// straight into Radar the bot, with the full cockpit one tap away
// (ARCHITECTURE.md §5 — bot-first routing).

import { useEffect, useMemo, useState } from 'react';
import { AuthGate } from './auth/AuthGate';
import { AssistantRail } from './components/AssistantRail';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import type { ViewKey } from './domain/types';
import { MobileBot } from './mobile/MobileBot';
import { useStore } from './state/store';
import { GemsView } from './views/GemsView';
import { PipelineView } from './views/PipelineView';
import { ProfileView } from './views/ProfileView';
import { RecommendedView } from './views/RecommendedView';
import { ScoutsView } from './views/ScoutsView';
import { SearchView } from './views/SearchView';

const PATH_TO_VIEW: Record<string, ViewKey> = {
  '/scout': 'radar',
  '/scouts': 'radar',
  '/recommended': 'recommend',
  '/gems': 'gems',
  '/search': 'search',
  '/pipeline': 'pipeline',
  '/profile': 'profile',
};

function useIsMobile(): boolean {
  const query = useMemo(() => window.matchMedia('(max-width: 820px)'), []);
  const [mobile, setMobile] = useState(query.matches);
  useEffect(() => {
    const onChange = (e: MediaQueryListEvent) => setMobile(e.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [query]);
  return mobile;
}

export default function App() {
  const { state, dispatch, startRun } = useStore();
  const isMobile = useIsMobile();
  // On small screens the bot is home; the cockpit is the escape hatch.
  const [mode, setMode] = useState<'bot' | 'cockpit'>(() =>
    window.matchMedia('(max-width: 820px)').matches ||
    new URLSearchParams(window.location.search).get('source') === 'pwa'
      ? 'bot'
      : 'cockpit',
  );

  // Deep links + PWA app shortcuts (/?action=sweep, /?view=queue).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const deepView = PATH_TO_VIEW[window.location.pathname];
    if (deepView) {
      dispatch({ type: 'SET_VIEW', view: deepView });
      setMode('cockpit');
    }
    if (params.get('action') === 'sweep') startRun();
    if (params.get('view') === 'queue') dispatch({ type: 'OPEN_ASSISTANT' });
    // run once on load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!state.authed) return <AuthGate />;

  if (isMobile && mode === 'bot') {
    return (
      <MobileBot
        onOpenCockpit={(view) => {
          dispatch({ type: 'SET_VIEW', view });
          setMode('cockpit');
        }}
      />
    );
  }

  return (
    <div
      data-rr="shell"
      style={{
        display: 'flex',
        height: '100vh',
        width: '100%',
        fontFamily: "'IBM Plex Sans', sans-serif",
        background: 'var(--rr-paper)',
        overflow: 'hidden',
      }}
    >
      <Sidebar />

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <TopBar onBackToBot={isMobile ? () => setMode('bot') : undefined} />
        <div data-rr="content" style={{ flex: 1, overflowY: 'auto', padding: '24px 26px 60px' }}>
          {state.view === 'radar' && <ScoutsView />}
          {state.view === 'recommend' && <RecommendedView />}
          {state.view === 'gems' && <GemsView />}
          {state.view === 'search' && <SearchView />}
          {state.view === 'pipeline' && <PipelineView />}
          {state.view === 'profile' && <ProfileView />}
        </div>
      </main>

      <AssistantRail />
    </div>
  );
}
