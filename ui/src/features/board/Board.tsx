/**
 * Every conversation on this machine, in four lanes.
 *
 * ── The gap this closes ─────────────────────────────────────────────────────
 *
 * The product's whole claim is that you run several conversations at once,
 * across several projects — and until now the only way to see one was to open
 * the project it belongs to and find its tab. So somebody with four builds
 * going had four places to look, no total, and no way to answer "is anything
 * still working" except by clicking through everything.
 *
 * ── Why the lanes are what they are ─────────────────────────────────────────
 *
 * A board whose columns are dragged by hand is wrong by Thursday: it records
 * what somebody last remembered to move. Every lane here is derived in
 * `daemon/src/board.ts` from something already true — a process with a turn in
 * flight, a place in the queue, who spoke last, when. There is nothing to
 * maintain and therefore nothing to go stale, and no card can be dragged
 * anywhere, because there is nowhere for a person to put one that would mean
 * anything.
 *
 * ── Why they do not look alike ──────────────────────────────────────────────
 *
 * Four columns of identical cards is a spreadsheet with rounded corners, and
 * the lanes are not equivalent: one is live, one is a promise, one is a
 * request, one is history. So each reads differently on purpose — a lit rule
 * and a moving mark for what is running, a number for what is in line, the last
 * thing said for what is waiting on you.
 *
 * And a lane with nothing in it is not drawn at all. Four fixed columns is the
 * obvious build and it is wrong for the ordinary case: one idle conversation
 * produced three columns of "Nothing is…" around a single card squeezed into a
 * quarter of the page. The grid is sized to the lanes that have something; what
 * the empty ones were saying is said once, in a line, underneath.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Lane, SessionBoard, SessionCard } from '@superbuilds/protocol';
import { api } from '@/lib/api';
import { useStore, navigate, toast, ask } from '@/lib/store';
import { Button, Empty, Index, Spinner, cx } from '@/components/ui';
import { Icon } from '@/components/icons';

const LANES: Array<{ id: Lane; name: string; hint: string; quiet: string }> = [
  { id: 'running', name: 'Working now', hint: 'a turn is in flight', quiet: 'Nothing is running.' },
  { id: 'queued', name: 'In line', hint: 'waiting for a free slot', quiet: 'Nothing is waiting.' },
  { id: 'you', name: 'Your move', hint: 'it replied, or it needs you', quiet: 'Nothing is waiting on you.' },
  { id: 'resting', name: 'Earlier', hint: 'untouched for a day or more', quiet: 'Nothing older than today.' },
];

/**
 * Written out rather than composed, because Tailwind reads the source for the
 * class names it is going to need and cannot read a template literal.
 */
const COLS: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-2 lg:grid-cols-3',
  4: 'sm:grid-cols-2 xl:grid-cols-4',
};

const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`;

export function Board({ project }: { project?: string }) {
  const [board, setBoard] = useState<SessionBoard | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Everything the daemon pushes that could change a card. The board is one
  // small local request, so reacting to all of it is cheaper than being clever
  // about which event moved which conversation.
  const sessions = useStore((s) => s.sessions);
  const capacity = useStore((s) => s.capacity);
  const projects = useStore((s) => s.projects);
  const connected = useStore((s) => s.connected);

  const load = useCallback(async () => {
    try { setBoard(await api.board()); setError(''); }
    catch (e) { setError((e as Error).message); }
  }, []);

  // Coalesced: a running turn emits a delta per token, and each one lands in
  // the store. Refetching on every one would be a request per character.
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { void load(); }, 400);
    return () => clearTimeout(timer.current);
  }, [sessions, capacity, projects, connected, load]);

  useEffect(() => { void useStore.getState().loadProjects().catch(() => {}); }, []);

  // Relative times go stale on their own, with no event to say so.
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 20_000);
    return () => clearInterval(id);
  }, []);

  const all = board?.cards ?? [];
  const cards = useMemo(() => (project ? all.filter((c) => c.projectId === project) : all), [all, project]);
  const counts = useMemo(() => {
    const by = new Map<string, number>();
    for (const c of all) by.set(c.projectId, (by.get(c.projectId) ?? 0) + 1);
    return by;
  }, [all]);

  const byLane = useMemo(() => {
    const m = new Map<Lane, SessionCard[]>(LANES.map((l) => [l.id, [] as SessionCard[]]));
    for (const c of cards) m.get(c.lane)!.push(c);
    return m;
  }, [cards]);
  const shown = LANES.filter((l) => byLane.get(l.id)!.length > 0);
  const empty = LANES.filter((l) => byLane.get(l.id)!.length === 0);

  const named = project ? projects[project]?.name ?? cards[0]?.projectName : undefined;
  const running = cards.filter((c) => c.lane === 'running').length;
  const ceiling = board?.capacity.ceiling ?? 0;

  const start = async () => {
    if (!project) return;
    setBusy(true);
    try {
      const s = await api.newSession(project);
      navigate({ name: 'project', id: project, session: s.id });
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  };

  return (
    <div className="shell-wide pt-12">
      <Index n={2} className="mb-8">Sessions</Index>

      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
        <div className="min-w-0">
          <h1 className="d2">{named ? 'This project’s conversations.' : 'What this machine is doing.'}</h1>
          <p className="copy mt-2.5">
            {!board ? 'Reading every conversation on this machine…'
              : !cards.length ? 'No conversations yet. One is opened for you the moment a project starts building.'
              : named
                ? `${count(cards.length, 'conversation')} about ${named}. They share one set of notes, so each knows what the others have been doing.`
                : running
                  ? `${count(cards.length, 'conversation')} across ${count(counts.size, 'project')}. ${running} running of the ${ceiling} this machine carries at once; anything over that waits its turn and starts on its own.`
                  : `${count(cards.length, 'conversation')} across ${count(counts.size, 'project')}. Nothing is running at the moment — this machine will carry ${ceiling} at once when you want it to.`}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {project && <Button variant="primary" icon="plus" busy={busy} onClick={start}>New conversation</Button>}
          {project && <Button iconRight="arrowRight" onClick={() => navigate({ name: 'project', id: project })}>Open the project</Button>}
        </div>
      </div>

      {/* Six empty cells saying nothing is running is a diagram of an absence.
          The sentence above already said it. */}
      {board && (board.capacity.running > 0 || board.capacity.waiting.length > 0) && (
        <Load running={board.capacity.running} ceiling={ceiling} waiting={board.capacity.waiting.length} />
      )}

      {all.length > 0 && counts.size > 1 && (
        <div className="flex flex-wrap items-center gap-1.5 mt-6">
          <Filter on={!project} onClick={() => navigate({ name: 'sessions' })} n={all.length}>Every project</Filter>
          {[...counts.entries()]
            .sort((a, b) => (projects[a[0]]?.name ?? '').localeCompare(projects[b[0]]?.name ?? ''))
            .map(([id, n]) => (
              <Filter key={id} on={project === id} onClick={() => navigate({ name: 'sessions', project: id })} n={n}>
                {projects[id]?.name ?? all.find((c) => c.projectId === id)?.projectName ?? 'Project'}
              </Filter>
            ))}
        </div>
      )}

      {error && !board ? (
        <div className="mt-10"><Empty icon="alert" title="The board could not be read." body={error} action={<Button icon="refresh" onClick={() => void load()}>Try again</Button>} /></div>
      ) : !board ? (
        <div className="mt-16 grid place-items-center"><Spinner size={20} className="text-volt" /></div>
      ) : !cards.length ? (
        <div className="mt-10">
          <Empty
            icon="chat"
            title="Nothing to show yet."
            body="Every project gets a conversation when it starts building, and you can open as many more as you like — one for the menu page, one for the colours, one for the booking form. They all appear here."
            action={<Button variant="primary" iconRight="arrowRight" onClick={() => navigate({ name: 'projects' })}>Go to your sites</Button>}
          />
        </div>
      ) : (
        <>
          {/*
            Only the lanes with something in them, and the grid sized to how
            many that is.

            Four fixed columns was the obvious build and it was wrong for the
            ordinary case: one idle conversation produced three columns reading
            "Nothing is running", "Nothing is waiting", "Nothing is waiting on
            you" — three negatives to say one thing, with the single real card
            squeezed into a quarter of the page. A board is a good shape when
            there is a board's worth of work and a bad one when there is not.
            What the empty lanes were saying is said once, in a line, below.
          */}
          <div className={cx('grid gap-x-4 gap-y-8 mt-9', COLS[Math.min(shown.length, 4)])}>
            {shown.map((l) => (
              <Column key={l.id} lane={l} cards={byLane.get(l.id)!} showProject={!project} onChanged={load}>
                {byLane.get(l.id)!.length}
              </Column>
            ))}
          </div>

          {empty.length > 0 && (
            <p className="telemetry text-bone-4 mt-8 pt-3 border-t border-line">
              {empty.map((l) => l.quiet.replace(/\.$/, '')).join(' · ').toLowerCase()}
            </p>
          )}
        </>
      )}
    </div>
  );
}

/**
 * What the machine is carrying, as one cell per slot.
 *
 * A bar would say the same thing less honestly: the ceiling is a small whole
 * number of conversations, not a percentage, and drawing it as a continuous
 * quantity invites the question "how full is the last one".
 */
function Load({ running, ceiling, waiting }: { running: number; ceiling: number; waiting: number }) {
  return (
    <div className="flex items-center gap-3 mt-6">
      <span className="flex items-center gap-1" role="img" aria-label={`${running} of ${ceiling} slots in use`}>
        {Array.from({ length: ceiling }, (_, i) => (
          <span key={i} className={cx('h-[14px] w-[7px] rounded-[2px]', i < running ? 'bg-volt' : 'bg-ink-4 border border-line')} />
        ))}
      </span>
      <span className="telemetry text-bone-4">
        {running} of {ceiling} running{waiting > 0 ? ` · ${waiting} in line` : ''}
      </span>
    </div>
  );
}

function Filter({ children, n, on, onClick }: { children: React.ReactNode; n: number; on: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} data-on={on ? 'true' : undefined} className="chip">
      <span className="truncate max-w-[180px]">{children}</span>
      <span className={cx('telemetry', on ? 'text-volt' : 'text-bone-4')}>{n}</span>
    </button>
  );
}

function Column({ lane, cards, showProject, onChanged, children }: {
  lane: (typeof LANES)[number];
  cards: SessionCard[];
  showProject: boolean;
  onChanged: () => Promise<void>;
  children: React.ReactNode;
}) {
  const live = lane.id === 'running';
  return (
    <section className="min-w-0 flex flex-col">
      <header className="flex items-baseline gap-2 pb-2">
        <h2 className="legend text-bone-2">{lane.name}</h2>
        <span className={cx('telemetry', live && cards.length ? 'text-volt' : 'text-bone-4')}>{children}</span>
      </header>
      <div className={cx('h-px', live && cards.length ? 'bg-volt-3' : 'bg-line')} />
      <p className="telemetry text-bone-4 pt-2">{lane.hint}</p>

      <div className="flex flex-col gap-2 mt-3">
        {cards.map((c) => <Card key={c.id} c={c} showProject={showProject} onChanged={onChanged} />)}
      </div>
    </section>
  );
}

function Card({ c, showProject, onChanged }: { c: SessionCard; showProject: boolean; onChanged: () => Promise<void> }) {
  const [acting, setActing] = useState(false);
  const open = () => navigate({ name: 'project', id: c.projectId, session: c.id });

  const stop = async () => {
    setActing(true);
    try {
      const { how } = await api.stop(c.id);
      toast(how === 'none' ? 'It had already finished.' : 'Stopped. Everything it had written is still there.', 'ok');
      await onChanged();
    } catch (e) { toast((e as Error).message, 'error'); } finally { setActing(false); }
  };

  const close = async () => {
    const yes = await ask({
      title: `Close “${c.title}”?`,
      body: 'The conversation goes. What it built does not.',
      points: ['every file it changed stays exactly as it is', 'all of it is in git, so nothing is lost either way', 'the other conversations about this project are unaffected'],
      confirmLabel: 'Close it', icon: 'x', danger: true,
    });
    if (!yes) return;
    setActing(true);
    try { await api.deleteSession(c.id); await onChanged(); }
    catch (e) { toast((e as Error).message, 'error'); } finally { setActing(false); }
  };

  const live = c.lane === 'running';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } }}
      className={cx(
        'group panel-2 text-left p-3 cursor-pointer transition-colors outline-none',
        'hover:border-line-2 focus-visible:border-volt-3',
        live && 'border-volt-3 bg-volt-2',
        c.failed && 'border-danger/35',
      )}
    >
      {showProject && <p className="telemetry text-bone-4 truncate mb-1.5">{c.projectName}</p>}

      <div className="flex items-start gap-2">
        <Mark c={c} />
        <h3 className="text-[13.5px] font-semibold leading-snug text-bone flex-1 min-w-0 break-words">{c.title}</h3>
      </div>

      {c.lane === 'queued' ? (
        <p className="text-[12.5px] text-warn mt-2">Number {c.place} in line. It starts on its own.</p>
      ) : c.failed ? (
        <p className="text-[12.5px] text-danger mt-2">Something went wrong on the last turn. Open it to see what.</p>
      ) : c.last ? (
        <p className="text-[12.5px] leading-relaxed text-bone-3 mt-2 line-clamp-2">
          <span className="text-bone-4">{c.last.role === 'user' ? 'You: ' : c.last.role === 'system' ? 'Note: ' : ''}</span>
          {c.last.text}
        </p>
      ) : (
        <p className="text-[12.5px] text-bone-4 mt-2">Nothing said yet.</p>
      )}

      <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-line">
        <span className="telemetry text-bone-4 truncate">
          {c.turns ? `${c.turns} turn${c.turns === 1 ? '' : 's'} · ` : ''}{ago(c.updatedAt)}
        </span>
        <span className="flex-1" />
        {/* The actions appear on hover on a mouse and are always there on
            touch, where there is no hover for them to appear on. */}
        <span className="flex items-center gap-0.5 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 transition-opacity">
          {live ? (
            <Button size="sm" variant="quiet" icon="stop" busy={acting} title="Stop this turn"
              onClick={(e) => { e.stopPropagation(); void stop(); }} />
          ) : (
            <Button size="sm" variant="quiet" icon="x" busy={acting} title="Close this conversation"
              onClick={(e) => { e.stopPropagation(); void close(); }} />
          )}
          <Button size="sm" variant="quiet" icon="arrowRight" title="Open it" onClick={(e) => { e.stopPropagation(); open(); }} />
        </span>
      </div>
    </div>
  );
}

/** The one glyph that says which of the four this is, without a word. */
function Mark({ c }: { c: SessionCard }) {
  if (c.lane === 'running') return <Spinner size={11} className="text-volt shrink-0 mt-[3px]" />;
  if (c.lane === 'queued') return <span className="telemetry text-warn shrink-0 mt-px num">{c.place}</span>;
  if (c.failed) return <Icon name="alert" size={12} className="text-danger shrink-0 mt-[3px]" />;
  return <span className={cx('w-[6px] h-[6px] rounded-full shrink-0 mt-[6px]', c.lane === 'you' ? 'bg-bone-3' : 'bg-bone-4')} />;
}

/**
 * How long ago, in the words people use.
 *
 * `Intl.RelativeTimeFormat` renders everything between 24 and 47 hours as
 * "1 day ago", which on a board about what happened today throws away the one
 * distinction that matters.
 */
function ago(at: number): string {
  const s = Math.max(0, Math.round((Date.now() - at) / 1000));
  if (s < 45) return 'just now';
  if (s < 90) return 'a minute ago';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d} day${d === 1 ? '' : 's'} ago`;
  return new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
