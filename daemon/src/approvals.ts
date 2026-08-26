/**
 * Asking, when the answer is not ours to give.
 *
 * `policy.ts` decides that something needs a human. This holds the question
 * open while somebody answers it.
 *
 * ── Why the hook waits rather than refusing and moving on ───────────────────
 *
 * Because a refusal Claude reads is a refusal it works around. Told "writing
 * outside the project is refused", it writes the file somewhere else and
 * carries on — which is how the person ends up watching four red banners go
 * past with no way to say "yes, obviously, go ahead". PreToolUse is a
 * synchronous gate: while the daemon has not answered it, the tool call has not
 * happened. So the question is asked *there*, in the gap, and the answer is the
 * hook's response. Say yes and the command runs — the real one, first time, not
 * a retry Claude had to think of.
 *
 * ── Why nobody there means no ───────────────────────────────────────────────
 *
 * A build runs for an hour, unattended, on purpose. If the tab is closed there
 * is nobody to ask, and blocking for two minutes per call to discover that
 * would turn one unanswerable question into a stalled build. So the caller
 * checks first, and an unwatched daemon refuses immediately with a sentence
 * that says why. Fail closed, and fail fast.
 *
 * ── Why a yes can cover the rest of the conversation, but never more ────────
 *
 * "Allow once" for a build that needs to write outside the project fifty times
 * is fifty presses, which is a refusal wearing a hat. So a yes can be granted
 * against the rule for the whole conversation. It is held in memory and keyed
 * by session: closing the app forgets it, and a new conversation asks again.
 * That is deliberate. A permission that outlives the reason it was given is how
 * every "allow all" toggle ends up permanently on.
 */

import { randomUUID } from 'node:crypto';
import type { Approval, ApprovalDecision } from '@superbuilds/protocol';

interface Pending {
  approval: Approval;
  settle: (d: ApprovalDecision) => void;
  timer: ReturnType<typeof setTimeout>;
}

const pending = new Map<string, Pending>();
/** sessionId → the rule ids that conversation has said yes to. */
const grants = new Map<string, Set<string>>();

/** How long a question stays open before it answers itself with a no. */
export const ASK_MS = 150_000;

/* ----------------------------------------------------------------- grants -- */

export function granted(sessionId: string, ruleId: string): boolean {
  return grants.get(sessionId)?.has(ruleId) ?? false;
}

export function grant(sessionId: string, ruleId: string): string[] {
  const set = grants.get(sessionId) ?? new Set<string>();
  set.add(ruleId);
  grants.set(sessionId, set);
  return [...set];
}

export function revoke(sessionId: string, ruleId: string): string[] {
  const set = grants.get(sessionId);
  set?.delete(ruleId);
  return set ? [...set] : [];
}

export function grantsFor(sessionId: string): string[] {
  return [...(grants.get(sessionId) ?? [])];
}

/* ---------------------------------------------------------------- pending -- */

export function pendingFor(sessionId?: string): Approval[] {
  const all = [...pending.values()].map((p) => p.approval);
  return (sessionId ? all.filter((a) => a.sessionId === sessionId) : all).sort((a, b) => a.askedAt - b.askedAt);
}

export function getApproval(id: string): Approval | undefined {
  return pending.get(id)?.approval;
}

/**
 * Open a question and wait for it.
 *
 * The promise resolves exactly once: on an answer, or on the timeout with a
 * no. `onAsk` runs after the entry exists, so a client that reacts to it by
 * immediately answering finds something to answer.
 */
export function askFor(
  draft: Omit<Approval, 'id' | 'askedAt' | 'expiresAt'>,
  onAsk: (a: Approval) => void,
  ms: number = ASK_MS,
): Promise<ApprovalDecision> {
  const askedAt = Date.now();
  const approval: Approval = { ...draft, id: randomUUID(), askedAt, expiresAt: askedAt + ms };

  return new Promise<ApprovalDecision>((resolve) => {
    let done = false;
    const finish = (d: ApprovalDecision) => {
      if (done) return;
      done = true;
      const entry = pending.get(approval.id);
      if (entry) clearTimeout(entry.timer);
      pending.delete(approval.id);
      resolve(d);
    };
    const timer = setTimeout(() => finish('no'), ms);
    // A pending question must never be the reason the daemon will not exit.
    timer.unref?.();
    pending.set(approval.id, { approval, settle: finish, timer });
    try { onAsk(approval); } catch { /* a broken listener is not the caller's problem */ }
  });
}

/** Answer one. Returns what was answered, or undefined if it had already gone. */
export function settleApproval(id: string, decision: ApprovalDecision): Approval | undefined {
  const entry = pending.get(id);
  if (!entry) return undefined;
  const { approval } = entry;
  if (decision === 'session') grant(approval.sessionId, approval.ruleId);
  entry.settle(decision);
  return approval;
}

/** The conversation is gone: refuse anything it left open, and forget its grants. */
export function dropSession(sessionId: string): Approval[] {
  const mine = pendingFor(sessionId);
  for (const a of mine) pending.get(a.id)?.settle('no');
  grants.delete(sessionId);
  return mine;
}

/** Only for tests: start from nothing. */
export function resetApprovals() {
  for (const entry of pending.values()) { clearTimeout(entry.timer); entry.settle('no'); }
  pending.clear();
  grants.clear();
}
