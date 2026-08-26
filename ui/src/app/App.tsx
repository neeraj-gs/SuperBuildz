import { useEffect, useState } from 'react';
import { useStore, connect, navigate } from '@/lib/store';
import { Logo, Button, Dot, cx } from '@/components/ui';
import { Toasts } from '@/components/Toasts';
import { Icon } from '@/components/icons';
import { Dialogs } from '@/components/Dialog';
import { Connection } from '@/components/Connection';
import { Landing } from '@/features/landing/Landing';
import { Setup } from '@/features/setup/Setup';
import { Dashboard } from '@/features/dashboard/Dashboard';
import { Wizard } from '@/features/wizard/Wizard';
import { Workspace } from '@/features/workspace/Workspace';
import { Revamp } from '@/features/revamp/Revamp';
import { Board } from '@/features/board/Board';
import { ContactModal } from '@/features/landing/Contact';
import { playDemo } from '@/features/landing/Demo';
import { LandingHostProvider } from '@/features/landing/host';

/**
 * One shell, one header. The header is defined here and nowhere else — an
 * earlier version let the landing page draw its own, which meant two navs
 * stacked on top of each other whenever a build went stale.
 */
export function App() {
  const route = useStore((s) => s.route);
  const connected = useStore((s) => s.connected);
  const detection = useStore((s) => s.detection);
  // Not in the store: nothing else needs to know, and nothing else opens it.
  const [contact, setContact] = useState(false);

  useEffect(() => { connect(); }, []);
  useEffect(() => {
    if (!connected) return;
    void useStore.getState().loadProjects();
    void useStore.getState().loadCatalogue();
    if (!detection) void useStore.getState().loadDetection().catch(() => {});
  }, [connected]); // eslint-disable-line react-hooks/exhaustive-deps

  // The workspace owns its whole viewport: its own header, its own scroll.
  if (route.name === 'project') {
    return (<><Workspace id={route.id} session={route.session} /><Toasts /><Dialogs /></>);
  }

  const overlay = route.name === 'landing';

  return (
    <div className="min-h-full flex flex-col">
      <TopBar overlay={overlay} onContact={() => setContact(true)} />
      <main className={cx('flex-1', overlay ? '' : 'pb-24')}>
        {/*
          Inside the app, every control on the landing page is a door into the
          product. On the deployed page there is no product to open, so the
          public host supplies none of them — see `features/landing/host.tsx`.
        */}
        {route.name === 'landing' && (
          <LandingHostProvider
            host={{
              mode: 'app',
              ready: !!detection?.ok,
              startLabel: detection?.ok ? 'Build a site' : 'Start — check requirements',
              start: () => navigate(detection?.ok ? { name: 'new' } : { name: 'setup' }),
              revamp: () => navigate({ name: 'revamp' }),
              requirements: () => navigate({ name: 'setup' }),
              doors: [
                { label: 'Revamp one you have', onClick: () => navigate({ name: 'revamp' }) },
                { label: 'Your projects', onClick: () => navigate({ name: 'projects' }) },
                { label: 'Every conversation', onClick: () => navigate({ name: 'sessions' }) },
                { label: 'What this machine needs', onClick: () => navigate({ name: 'setup' }) },
              ],
            }}
          >
            <Landing />
          </LandingHostProvider>
        )}
        {route.name === 'setup' && <Setup />}
        {route.name === 'projects' && <Dashboard />}
        {route.name === 'new' && <Wizard />}
        {route.name === 'revamp' && <Revamp />}
        {route.name === 'sessions' && <Board key={route.project ?? 'all'} project={route.project} />}
      </main>
      <Toasts />
      <Dialogs />
      <ContactModal open={contact} onClose={() => setContact(false)} />
    </div>
  );
}

function TopBar({ overlay, onContact }: { overlay: boolean; onContact: () => void }) {
  const route = useStore((s) => s.route);
  const detection = useStore((s) => s.detection);
  const capacity = useStore((s) => s.capacity);
  const ready = detection?.ok;
  const live = capacity?.running ?? 0;

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
      <div className="h-full bleed flex items-center justify-between gap-2 sm:gap-4">
        <button onClick={() => navigate({ name: 'landing' })} className="flex items-center shrink-0" aria-label="Super Builds — home">
          <Logo from="sm" />
        </button>

        {/*
          The bar is measured, not guessed.

          Every label used to switch on at `sm`, all six at once, at a width
          that could not hold them — so between 640 and 691 the page scrolled
          sideways, and between 420 and 476 the wordmark did the same thing on
          its own. Adding Contact widened both bands rather than creating them.

          Three tiers now, each one taken from what the row actually measures:
          below 640 it is a toolbar of marks with one word on the primary
          action; from 640 the name and the three short labels appear; from 820
          there is room for all of it. Nothing switches on until the row it
          belongs to fits.
        */}
        {/* Tighter below 640: the row is marks there, and marks do not need
            a word’s worth of air between them. */}
        <nav className="flex items-center gap-0.5 sm:gap-1">
          <NavLink on={route.name === 'setup'} onClick={() => navigate({ name: 'setup' })} title="What this machine needs installed">
            <Dot on={!!ready} tone={detection && !ready ? 'danger' : 'volt'} className={cx(!detection && 'pulse-dot')} />
            <span className="hidden min-[820px]:inline">Requirements</span>
          </NavLink>
          <NavLink on={route.name === 'projects'} onClick={() => navigate({ name: 'projects' })} title="Your sites">
            <span className="hidden sm:inline">Projects</span>
            <span className="sm:hidden"><Icon name="cube" size={14} /></span>
          </NavLink>
          {/* The count is the point: a header that says "3" while three builds
              run is the only place the parallelism is visible without opening
              anything. Absent when nothing is running, so it never reads as a
              badge that is always on. */}
          <NavLink on={route.name === 'sessions'} onClick={() => navigate({ name: 'sessions' })} title="Every conversation on this machine">
            <span className="hidden sm:inline">Sessions</span>
            <span className="sm:hidden"><Icon name="chat" size={14} /></span>
            {live > 0 && <span className="telemetry text-volt">{live}</span>}
          </NavLink>
          {/*
            Contact is not a route and does not become one: what somebody wants
            when they press it is an address, and a whole screen to hold five
            lines of contact details is a screen you then have to navigate back
            out of. It opens where you already are.
          */}
          {/*
            Demo is the seventh control on a bar that only just fitted six, and
            it is the one that is genuinely about the landing page rather than
            about the product — so it appears where the page it plays does, and
            nowhere else. The bar behind a build stays the width it was
            measured at.

            Its word arrives at 900 rather than 820 with the others, and that
            number is measured, not chosen: at 820 every other label switches on
            at once and the row is exactly full, so a seventh word there pushed
            the page 28px sideways from 820 to 849. The mark costs 30px less and
            is a play triangle, which needs no word.
          */}
          {route.name === 'landing' && (
            <NavLink onClick={playDemo} title="Watch a full run, start to finish" className="!px-2">
              <span className="hidden min-[900px]:inline">Demo</span>
              <span className="min-[900px]:hidden"><Icon name="play" size={13} /></span>
            </NavLink>
          )}
          <NavLink onClick={onContact} title="Who made this, and how to reach them">
            <span className="hidden sm:inline">Contact</span>
            <span className="sm:hidden"><Icon name="mail" size={14} /></span>
          </NavLink>
          <Button size="sm" icon="refresh" onClick={() => navigate({ name: 'revamp' })} title="Redesign a site you already have">
            <span className="hidden min-[820px]:inline">Revamp</span>
          </Button>
          <Button variant="primary" size="sm" icon="plus" className="ml-1 sm:ml-1.5" onClick={() => navigate({ name: 'new' })} title="Build a new site">
            <span>New<span className="hidden min-[820px]:inline"> site</span></span>
          </Button>
          <Connection className="ml-1.5" />
        </nav>
      </div>
    </header>
  );
}

function NavLink({ children, on, onClick, title, className }: { children: React.ReactNode; on?: boolean; onClick: () => void; title?: string; className?: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cx(
        // A mark does not need a word's worth of padding either side of it.
        'inline-flex items-center gap-2 h-8 px-2 sm:px-3 rounded-lg text-[13px] transition-colors',
        on ? 'text-bone bg-ink-3' : 'text-bone-3 hover:text-bone hover:bg-ink-2',
        className,
      )}
    >
      {children}
    </button>
  );
}
