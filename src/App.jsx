import ChatPage from './pages/ChatPage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccountProvider, useAccount } from './account/AccountProvider';
import { ACCOUNT_SECTIONS } from './account/navigation';
import AccountPage from './pages/AccountPage';
import { DEMO_DATA_ENABLED, isAutoSeedOn, seedDemoData } from './lib/demo-data';
import { SeiteLoader } from './components/SeiteLoader';
import { usePageNavigation } from './hooks/usePageNavigation';
import AuthPage from './pages/AuthPage';
import BillsPage from './pages/BillsPage';
import PlanPage from './pages/PlanPage';
import HomePage from './pages/HomePage';
import TrackerPage from './pages/TrackerPage';
const PAGE_TITLES = {
  home: 'Seite',
  signin: 'Welcome back',
  signup: 'Create your space',
  tracker: 'Daily spending',
  chat: 'AI companion',
  bills: 'Upcoming bills',
  plan: 'Your plan',
  ...Object.fromEntries(ACCOUNT_SECTIONS.map((section) => [section.id, section.label])),
};
export default function App() {
  return (
    <AccountProvider>
      <AppShell />
    </AccountProvider>
  );
}

function AppShell() {
  const { page, leaving, navigate } = usePageNavigation();
  const [loading, setLoading] = useState(false);
  const [authNotice, setAuthNotice] = useState('');
  const [entryView, setEntryView] = useState(null);
  const { beginPreview, endPreview, sessionActive } = useAccount();
  const container = useRef(null);
  useEffect(() => {
    document.title = `Seite · ${PAGE_TITLES[page]}`;
    setLoading(false);
    window.scrollTo?.({ top: 0, behavior: 'instant' });
  }, [page]);
  useEffect(() => {
    const heading = container.current?.querySelector('h1');
    heading?.setAttribute('tabindex', '-1');
    heading?.focus({ preventScroll: true });
  }, [page, loading]);
  // Sample entries are added once per sign-in, before the tracker loads them.
  const startSession = useCallback(async () => {
    if (DEMO_DATA_ENABLED && isAutoSeedOn() && !sessionActive) {
      try {
        await seedDemoData();
      } catch {
        /* The tracker still opens without sample data. */
      }
    }
    beginPreview();
    setAuthNotice('');
  }, [beginPreview, sessionActive]);
  const openTracker = useCallback(async () => {
    await startSession();
    navigate('tracker');
  }, [navigate, startSession]);
  const cancelLoading = useCallback(() => setLoading(false), []);
  async function visit(nextPage) {
    if (nextPage === 'tracker') await startSession();
    navigate(nextPage);
  }
  function signOut() {
    endPreview();
    setAuthNotice(
      'You’ve signed out of the local preview. Your saved entries and profile are still on this device.',
    );
    navigate('signin');
  }
  function dataDeleted() {
    setAuthNotice(
      'Your local data has been deleted. You can start fresh whenever you’re ready.',
    );
    navigate('signin');
  }
  return (
    <div ref={container} className={`page-scene ${leaving ? 'page-leaving' : ''}`}>
      <div className="page-enter" key={loading ? 'loading' : page}>
        {loading ? (
          <SeiteLoader onReady={openTracker} onCancel={cancelLoading} />
        ) : (
          <>
            {page === 'home' && <HomePage navigate={visit} />}
            {(page === 'signin' || page === 'signup') && (
              <AuthPage
                key={page}
                mode={page}
                navigate={visit}
                notice={authNotice}
                onContinue={() => setLoading(true)}
              />
            )}
            {page === 'tracker' && (
              <TrackerPage
                onHome={() => navigate('home')}
                navigate={visit}
                onSignOut={signOut}
                initialView={entryView}
              />
            )}
            {page === 'bills' && <BillsPage navigate={visit} onSignOut={signOut} />}
            {page === 'plan' && <PlanPage navigate={visit} onSignOut={signOut} />}
            {page === 'chat' && (
              <ChatPage
                navigate={visit}
                onViewEntries={(view) => {
                  setEntryView(view);
                  visit('tracker');
                }}
              />
            )}
            {ACCOUNT_SECTIONS.some((section) => section.id === page) && (
              <AccountPage
                key={page}
                section={page}
                navigate={visit}
                onSignOut={signOut}
                onDeleted={dataDeleted}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
