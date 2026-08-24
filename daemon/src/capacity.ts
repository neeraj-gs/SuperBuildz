/**
 * How many conversations this machine runs at once, and what happens to the rest.
 *
 * ── The failure this exists to stop ─────────────────────────────────────────
 *
 * Ported in shape from PowerHouse, which learned it the hard way. Nothing
 * limited anything across conversations, so starting four and letting a build
 * run launched five Claude Code processes, each a Node runtime plus a model
 * client plus whatever it decides to spawn. On a laptop that is not parallelism,
 * it is swapping — and the failure is nasty because it looks like the model
 * being slow. Everything runs, nothing errors, each one takes four times as
 * long, and the natural reaction is to start more.
 *
 * ── The ceiling is a default, not a policy ──────────────────────────────────
 *
 * Derived from the machine rather than picked: half the cores, clamped. Agents
 * are not CPU-bound most of the time — they are waiting on a model — so one per
 * core would be too cautious and one per thread too many. Half leaves a laptop
 * usable while it works.
 *
 * ── Queued, never refused ───────────────────────────────────────────────────
 *
 * A turn over the ceiling waits and then runs. Refusing it pushes the problem
 * back to the person, and "try again in a minute" is a worse answer than "it is
 * second in line". Dropping it silently would be indefensible.
 */

import { cpus } from 'node:os';

export interface QueuedTurn {
  sessionId: string;
  projectId: string;
  /** For the interface, so a waiting item can say what it is. */
  title: string;
  /** Runs the turn. Resolves or rejects with whatever the turn did. */
  start: () => Promise<unknown>;
}

/** What this machine can carry, unless somebody has said otherwise. */
export function ceiling(): number {
  const set = Number(process.env.SUPERBUILDS_MAX_AGENTS);
  if (Number.isFinite(set) && set >= 1) return Math.min(set, 16);
  const cores = cpus().length || 4;
  // One means nothing is parallel, which defeats the point; above six the
  // contention costs more than the concurrency buys on any laptop this runs on.
  return Math.max(2, Math.min(6, Math.floor(cores / 2)));
}

let countLive: () => number = () => 0;
export function configureCapacity(deps: { countLive: () => number }): void {
  countLive = deps.countLive;
}

const waiting: QueuedTurn[] = [];
const listeners = new Set<(q: QueuedTurn[]) => void>();

export function onQueueChange(fn: (q: QueuedTurn[]) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function announce() { for (const fn of listeners) fn([...waiting]); }

/** What is waiting, in order. Names only; nothing here is a secret. */
export function queued(): Array<{ sessionId: string; projectId: string; title: string; position: number }> {
  return waiting.map((j, i) => ({ sessionId: j.sessionId, projectId: j.projectId, title: j.title, position: i + 1 }));
}

/**
 * Start it now, or put it in line.
 *
 * Returns where it went so the caller can tell somebody. A queued turn is not a
 * failure and must not read as one.
 */
export function admitOrQueue(job: QueuedTurn): { started: boolean; position: number } {
  if (countLive() < ceiling()) {
    void job.start().catch(() => {}).finally(drain);
    return { started: true, position: 0 };
  }
  waiting.push(job);
  announce();
  return { started: false, position: waiting.length };
}

/** Called whenever something finishes: start whatever fits now. */
export function drain(): void {
  let changed = false;
  while (waiting.length && countLive() < ceiling()) {
    const next = waiting.shift()!;
    changed = true;
    void next.start().catch(() => {}).finally(drain);
  }
  if (changed) announce();
}

/** Take a session out of the queue — it was stopped, or its project was deleted. */
export function unqueue(sessionId: string): boolean {
  const i = waiting.findIndex((j) => j.sessionId === sessionId);
  if (i === -1) return false;
  waiting.splice(i, 1);
  announce();
  return true;
}

export function forgetQueue(): void {
  waiting.length = 0;
  announce();
}
