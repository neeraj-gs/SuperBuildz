import { useEffect } from 'react';
import { useStore, connect, navigate } from '@/lib/store';
import { Toasts, Logo, Button, Dot, cx } from '@/components/ui';
import { Landing } from '@/features/landing/Landing';
import { Setup } from '@/features/setup/Setup';
import { Dashboard } from '@/features/dashboard/Dashboard';
import { Wizard } from '@/features/wizard/Wizard';
import { Workspace } from '@/features/workspace/Workspace';

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

  const fullBleed = route.name === 'landing' || route.name === 'project';

  return (
    <div className="min-h-full flex flex-col">
      {route.name !== 'project' && <TopBar />}
      <main className={cx('flex-1', !fullBleed && 'px-6 md:px-10 lg:px-14 pb-20')}>
        {route.name === 'landing' && <Landing />}
        {route.name === 'setup' && <Setup />}
        {route.name === 'projects' && <Dashboard />}
        {route.name === 'new' && <Wizard />}
        {route.name === 'project' && <Workspace id={route.id} />}
      </main>
      <Toasts />
    </div>
  );
}

function TopBar() {
  const route = useStore((s) => s.route);
  const connected = useStore((s) => s.connected);
  const detection = useStore((s) => s.detection);
  const ready = detection?.ok;
  const onLanding = route.name === 'landing';
  return (
    <header className={cx('sticky top-0 z-40 h-14 flex items-center justify-between px-6 md:px-10 lg:px-14', onLanding ? 'bg-transparent' : 'bg-ink/80 backdrop-blur border-b border-line')}>
      <button onClick={() => navigate({ name: 'landing' })} className="flex items-center"><Logo /></button>
      <nav className="flex items-center gap-1">
        <NavLink on={route.name === 'setup'} onClick={() => navigate({ name: 'setup' })}>
          <Dot on={!!ready} className={cx(!detection && 'pulse-dot')} /> Requirements
        </NavLink>
        <NavLink on={route.name === 'projects'} onClick={() => navigate({ name: 'projects' })}>Projects</NavLink>
        <Button variant="primary" size="sm" icon="plus" className="ml-2" onClick={() => navigate({ name: 'new' })}>New site</Button>
        {!connected && <span className="telemetry text-danger ml-3">daemon offline</span>}
      </nav>
    </header>
  );
}

function NavLink({ children, on, onClick }: { children: React.ReactNode; on?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={cx('inline-flex items-center gap-2 h-9 px-3 rounded-full text-[13.5px] transition-colors', on ? 'text-bone bg-ink-3' : 'text-bone-2 hover:text-bone hover:bg-ink-2')}>
      {children}
    </button>
  );
}
