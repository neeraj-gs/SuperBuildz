import { useEffect, useState } from 'react';
import { useStore, connect, navigate } from '@/lib/store';
import { Toasts, Logo, Button, Dot, cx } from '@/components/ui';
import { Dialogs } from '@/components/Dialog';
import { Connection } from '@/components/Connection';
import { Landing } from '@/features/landing/Landing';
import { Setup } from '@/features/setup/Setup';
import { Dashboard } from '@/features/dashboard/Dashboard';
import { Wizard } from '@/features/wizard/Wizard';
import { Workspace } from '@/features/workspace/Workspace';
import { Revamp } from '@/features/revamp/Revamp';

/**
 * One shell, one header. The header is defined here and nowhere else — an
 * earlier version let the landing page draw its own, which meant two navs
 * stacked on top of each other whenever a build went stale.
 */
export function App() {
  const route = useStore((s) => s.route);
  const connected = useStore((s) => s.connected);
  const detection = useStore((s) => s.detection);

  useEffect(() => { connect(); }, []);
  useEffect(() => {
    if (!connected) return;
    void useStore.getState().loadProjects();
    void useStore.getState().loadCatalogue();
    if (!detection) void useStore.getState().loadDetection().catch(() => {});
  }, [connected]); // eslint-disable-line react-hooks/exhaustive-deps

  // The workspace owns its whole viewport: its own header, its own scroll.
  if (route.name === 'project') {
    return (<><Workspace id={route.id} /><Toasts /><Dialogs /></>);
  }

  const overlay = route.name === 'landing';

  return (
    <div className="min-h-full flex flex-col">
      <TopBar overlay={overlay} />
      <main className={cx('flex-1', overlay ? '' : 'pb-24')}>
        {route.name === 'landing' && <Landing />}
        {route.name === 'setup' && <Setup />}
        {route.name === 'projects' && <Dashboard />}
        {route.name === 'new' && <Wizard />}
        {route.name === 'revamp' && <Revamp />}
      </main>
      <Toasts />
      <Dialogs />
    </div>
  );
}

function TopBar({ overlay }: { overlay: boolean }) {
  const route = useStore((s) => s.route);
  const detection = useStore((s) => s.detection);
  const ready = detection?.ok;

  /*
    The landing page's header floats over its own hero, which only works while
    there is a hero under it. Past that, display type scrolls up into the
    wordmark and the two read as one wrong thing. So the bar takes its ground
    the moment the page moves.
  */
  const [moved, setMoved] = useState(false);
  useEffect(() => {
    if (!overlay) { setMoved(false); return; }
    const onScroll = () => setMoved(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [overlay]);

  return (
    <header
      className={cx(
        'sticky top-0 z-50 h-[52px] shrink-0 transition-colors duration-300',
        overlay && !moved ? 'bg-transparent' : 'bg-ink/85 backdrop-blur-xl border-b border-line',
      )}
    >
      <div className="h-full bleed flex items-center justify-between gap-4">
        <button onClick={() => navigate({ name: 'landing' })} className="flex items-center shrink-0" aria-label="Super Builds — home">
          <Logo />
        </button>

        <nav className="flex items-center gap-1">
          <NavLink on={route.name === 'setup'} onClick={() => navigate({ name: 'setup' })}>
            <Dot on={!!ready} tone={detection && !ready ? 'danger' : 'volt'} className={cx(!detection && 'pulse-dot')} />
            <span className="hidden sm:inline">Requirements</span>
          </NavLink>
          <NavLink on={route.name === 'projects'} onClick={() => navigate({ name: 'projects' })}>Projects</NavLink>
          {/* On a narrow screen the four controls were 516px wide on a 390px
              phone and the last one simply left the building. The words go
              first; the actions stay. */}
          <Button size="sm" icon="refresh" onClick={() => navigate({ name: 'revamp' })} title="Redesign a site you already have">
            <span className="hidden sm:inline">Revamp</span>
          </Button>
          <Button variant="primary" size="sm" icon="plus" className="ml-1.5" onClick={() => navigate({ name: 'new' })} title="Build a new site">
            <span>New<span className="hidden sm:inline"> site</span></span>
          </Button>
          <Connection className="ml-1.5" />
        </nav>
      </div>
    </header>
  );
}

function NavLink({ children, on, onClick }: { children: React.ReactNode; on?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cx(
        'inline-flex items-center gap-2 h-8 px-3 rounded-lg text-[13px] transition-colors',
        on ? 'text-bone bg-ink-3' : 'text-bone-3 hover:text-bone hover:bg-ink-2',
      )}
    >
      {children}
    </button>
  );
}
