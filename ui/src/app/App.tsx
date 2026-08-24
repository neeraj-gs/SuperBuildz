import { useEffect } from 'react';
import { useStore, connect, navigate } from '@/lib/store';
import { Toasts, Logo, Button, Dot, cx } from '@/components/ui';
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
    return (<><Workspace id={route.id} /><Toasts /></>);
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
    </div>
  );
}

function TopBar({ overlay }: { overlay: boolean }) {
  const route = useStore((s) => s.route);
  const connected = useStore((s) => s.connected);
  const detection = useStore((s) => s.detection);
  const ready = detection?.ok;

  return (
    <header
      className={cx(
        'sticky top-0 z-50 h-[52px] shrink-0',
        overlay ? 'bg-transparent' : 'bg-ink/85 backdrop-blur-xl border-b border-line',
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
          <Button size="sm" icon="refresh" onClick={() => navigate({ name: 'revamp' })} title="Redesign a site you already have">Revamp</Button>
          <Button variant="primary" size="sm" icon="plus" className="ml-1.5" onClick={() => navigate({ name: 'new' })}>New site</Button>
          {!connected && <span className="telemetry text-danger ml-2 hidden md:inline">daemon offline</span>}
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
