/**
 * Every conversation on this machine, on one board.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 *
 * The product's own claim is that you run several conversations at once, across
 * several projects. Until now the only way to see one was to open the project
 * it belongs to and find its tab — so the parallelism was real and invisible,
 * and the honest answer to "what is my machine doing" was to click through
 * every project in turn. A person with four builds going had four places to
 * look and no total.
 *
 * ── Why the lanes are computed, never set ───────────────────────────────────
 *
 * A board whose columns are dragged by hand is a board that is wrong by
 * Thursday: it records what somebody last remembered to move, not what is
 * happening. Every lane here is derived from something already true — a process
 * with a turn in flight, a place in the queue, who spoke last, when. Nothing on
 * this board is a field anybody maintains, which is also why it cannot go
 * stale.
 *
 * ── Why it is not just `listSessions` ───────────────────────────────────────
 *
 * A `Session` carries every turn it has ever had, each with its tool calls. Forty
 * conversations is megabytes of transcript to draw forty cards that show one
 * line each. `SessionCard` is that line.
 */

import type { Lane, Session, SessionCard, SessionBoard } from '@superbuilds/protocol';
import { listProjects, listSessions } from './store.ts';
import { ceiling, queued } from './capacity.ts';

/**
 * Untouched for this long and a conversation is history rather than a thing in
 * progress. A day, because that is the span people actually think in — "still
 * on it" against "that was yesterday" — and because anything shorter files a
 * conversation you had over lunch under the past.
 */
export const RESTING_AFTER_MS = 24 * 60 * 60 * 1000;

/** One line of what was last said, without the markdown or the newlines. */
function oneLine(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')     // a code block is never the summary
    .replace(/[*_`#>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);
}

/**
 * Which lane, given what is true right now.
 *
 * Order matters and is the order of urgency: something running is running
 * whatever else is true of it; something in line is in line; a failure outranks
 * an ordinary reply. Everything left is sorted by whether anybody has touched
 * it today.
 */
export function laneFor(
  s: Pick<Session, 'status' | 'turns' | 'updatedAt'>,
  opts: { busy: boolean; place?: number; now?: number },
): Lane {
  if (opts.busy) return 'running';
  if (opts.place !== undefined) return 'queued';

  const now = opts.now ?? Date.now();
  const last = s.turns[s.turns.length - 1];
  if (s.status === 'error' || last?.error) return 'you';

  // Nothing said yet: it exists because somebody opened it, and it is waiting
  // for the first thing they want done.
  if (!last) return now - s.updatedAt < RESTING_AFTER_MS ? 'you' : 'resting';

  if (now - s.updatedAt >= RESTING_AFTER_MS) return 'resting';

  // Claude spoke last and stopped, so the move is the person's. A user turn
  // sitting here with nothing running means the reply is already in — which is
  // the same lane by a different route.
  return 'you';
}

function cardFor(s: Session, projectName: string, busy: boolean, place: number | undefined, now: number): SessionCard {
  const last = s.turns[s.turns.length - 1];
  return {
    id: s.id,
    projectId: s.projectId,
    projectName,
    title: s.title,
    lane: laneFor(s, { busy, place, now }),
    status: s.status,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    busy,
    place,
    turns: s.turns.length,
    costUsd: s.costUsd,
    model: s.model,
    last: last ? { role: last.role, text: oneLine(last.text), at: last.at } : undefined,
    failed: !!last?.error || s.status === 'error',
  };
}

/**
 * The board.
 *
 * `isBusy` is injected rather than imported so this module stays a pure read of
 * what is on disk plus what the caller knows about live processes — which is
 * what makes `laneFor` testable without spawning anything.
 */
export function sessionBoard(isBusy: (sessionId: string) => boolean, now = Date.now()): SessionBoard {
  const names = new Map(listProjects().map((p) => [p.id, p.name]));
  const waiting = queued();
  const places = new Map(waiting.map((w) => [w.sessionId, w.position]));

  const cards: SessionCard[] = [];
  let running = 0;
  for (const s of listSessions()) {
    // A conversation whose project has been deleted has nothing to open. It is
    // not shown rather than shown as an orphan somebody would then try to click.
    const projectName = names.get(s.projectId);
    if (projectName === undefined) continue;
    const busy = isBusy(s.id);
    if (busy) running += 1;
    cards.push(cardFor(s, projectName, busy, places.get(s.id), now));
  }

  // Newest activity first inside whatever lane it lands in.
  cards.sort((a, b) => b.updatedAt - a.updatedAt);
  return { cards, capacity: { running, ceiling: ceiling(), waiting } };
}
