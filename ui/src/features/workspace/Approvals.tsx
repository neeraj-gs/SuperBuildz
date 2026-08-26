/**
 * "It wants to do this. Yes, always, or no."
 *
 * ── Why this is pinned rather than in the transcript ────────────────────────
 *
 * Because the build is stopped while it is on screen. The tool call is held
 * open on the daemon — nothing has run, nothing will run, and the stage clock
 * is ticking — so this is not a notification that can wait its turn behind
 * whatever Claude is saying. It sits above the composer, where the person is
 * already looking, until it is answered.
 *
 * ── Why the command is shown in full ────────────────────────────────────────
 *
 * A permission prompt that summarises what it is about to run is a prompt
 * nobody can answer honestly. "Run a command outside the project" could be
 * anything. So there is a sentence for somebody who does not read shell, and
 * under it the exact text, wrapped rather than truncated, because the dangerous
 * part of a long command is rarely at the front.
 *
 * ── Why there are three answers and not two ─────────────────────────────────
 *
 * A build that needs to write outside the project once needs to do it forty
 * times. Two buttons would make "allow" mean forty presses, which is a refusal
 * wearing a hat, and the person would learn to dread the card. So the middle
 * answer covers the rule for the rest of the conversation — named in the
 * button, not hidden in a tooltip — and it is forgotten when the conversation
 * ends.
 *
 * ── Why it counts down ──────────────────────────────────────────────────────
 *
 * Because it refuses itself after two and a half minutes, and a control that
 * expires without saying so is a control that has lied to you. The clock is the
 * honest version: answer it, or watch it answer no.
 */

import { useEffect, useState } from 'react';
import type { Approval, ApprovalDecision } from '@superbuilds/protocol';
import { api } from '@/lib/api';
import { useStore, toast } from '@/lib/store';
import { Button, cx } from '@/components/ui';
import { Icon } from '@/components/icons';

export function Approvals({ sessionId }: { sessionId: string }) {
  const queue = useStore((s) => s.approvals[sessionId]);
  const first = queue?.[0];
  if (!first) return null;
  return <Card key={first.id} approval={first} waiting={(queue?.length ?? 1) - 1} />;
}

function Card({ approval, waiting }: { approval: Approval; waiting: number }) {
  const [busy, setBusy] = useState<ApprovalDecision | null>(null);
  const left = useCountdown(approval.expiresAt);

  const answer = async (decision: ApprovalDecision) => {
    setBusy(decision);
    try {
      await api.answer(approval.id, decision);
    } catch (e) {
      // The daemon drops it from the store either way; saying nothing here
      // would leave a card that does not respond to being pressed.
      toast((e as Error).message, 'error');
      useStore.setState((s) => ({
        approvals: { ...s.approvals, [approval.sessionId]: (s.approvals[approval.sessionId] ?? []).filter((a) => a.id !== approval.id) },
      }));
    } finally { setBusy(null); }
  };

  return (
    <div
      role="alertdialog"
      aria-label="Claude is waiting for permission"
      className={cx(
        'mx-3 mb-2 rounded-xl border p-3.5 rise',
        approval.danger ? 'border-danger/45 bg-danger/[0.07]' : 'border-volt/45 bg-volt/[0.06]',
      )}
    >
      <div className="flex items-start gap-2.5">
        <Icon name={approval.danger ? 'alert' : 'shield'} size={16} className={cx('shrink-0 mt-0.5', approval.danger ? 'text-danger' : 'text-volt')} />
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-[13.5px] leading-snug">{approval.what}</div>
          <div className="telemetry text-bone-4 mt-0.5">
            it is waiting · {left}
            {waiting > 0 && <> · {waiting} more after this</>}
          </div>
        </div>
      </div>

      {/*
        `break-all` and not `truncate`. A command with its end cut off is the
        half nobody needed to see; what a person is deciding about is usually
        the argument, and the argument is at the end.
      */}
      {approval.detail && (
        <pre className="telemetry text-bone-2 bg-ink border border-line rounded-lg mt-2.5 p-2.5 max-h-32 overflow-auto whitespace-pre-wrap break-all">{approval.detail}</pre>
      )}

      <div className="flex flex-wrap items-center gap-2 mt-3">
        <Button size="sm" variant="primary" icon="check" busy={busy === 'once'} onClick={() => answer('once')}>Allow once</Button>
        <Button size="sm" variant="ghost" busy={busy === 'session'} onClick={() => answer('session')} title={approval.scope}>
          Always in this chat
        </Button>
        <span className="flex-1" />
        <Button size="sm" variant="quiet" icon="x" busy={busy === 'no'} onClick={() => answer('no')}>No</Button>
      </div>

      {approval.scope && (
        <p className="text-[11.5px] leading-snug text-bone-4 mt-2">
          Always covers {approval.scope} until this conversation is closed, and nothing beyond it.
        </p>
      )}
    </div>
  );
}

/** The time left, in the units somebody would actually say out loud. */
function useCountdown(at: number): string {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const s = Math.max(0, Math.round((at - now) / 1000));
  if (s === 0) return 'no answer, so no';
  if (s < 60) return `${s}s to answer`;
  return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s to answer`;
}

/**
 * What this conversation may already do, ahead of being asked.
 *
 * The card above is the answer to "it is asking now". This is the answer to "I
 * know what it is going to need, stop asking me" — the same grants, switched on
 * before anything stops. Both write to the same place, and both are forgotten
 * when the conversation ends.
 */
export function AccessPanel({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const grantedIds = useStore((s) => s.access[sessionId]);
  const [rules, setRules] = useState<Array<{ id: string; what: string; scope?: string; danger?: boolean }>>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    void api.access(sessionId)
      .then((a) => { setRules(a.rules); useStore.setState((s) => ({ access: { ...s.access, [sessionId]: a.granted } })); })
      .catch((e) => toast((e as Error).message, 'error'));
  }, [sessionId]);

  const on = new Set(grantedIds ?? []);
  const toggle = async (id: string) => {
    setBusy(id);
    try {
      const r = await api.setAccess(sessionId, id, !on.has(id));
      useStore.setState((s) => ({ access: { ...s.access, [sessionId]: r.granted } }));
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(null); }
  };

  return (
    <div className="fixed inset-0 z-[110] grid place-items-center p-4 fade bg-ink/70 backdrop-blur-[3px]" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      {/*
        Header and footer are fixed and only the list scrolls. Eight rows do not
        fit a short window, and a dialog whose only way out has scrolled off the
        bottom is a dialog somebody is stuck in.
      */}
      <div className="panel noise relative w-[min(560px,100%)] max-h-[min(86svh,720px)] flex flex-col shadow-2xl shadow-black/70 rise">
        <div className="p-6 pb-4 shrink-0">
          <button onClick={onClose} aria-label="Close" className="absolute top-4 right-4 text-bone-4 hover:text-bone"><Icon name="x" size={14} /></button>
          <h3 className="legend">This conversation</h3>
          <p className="d3 mt-2">What it may do to the machine</p>
          <p className="text-[13px] leading-relaxed text-bone-3 mt-3">
            Everything inside the project folder is already allowed and is never asked about. These are
            the things outside it. Leave them off and it stops and asks when it needs one; switch one on
            and it will not ask again here.
          </p>
        </div>

        <ul className="flex-1 min-h-0 overflow-y-auto px-6 border-t border-line">
          {rules.map((r) => (
            <li key={r.id} className="flex items-start gap-3 py-3 border-b border-line last:border-b-0">
              <button
                type="button"
                role="switch"
                aria-checked={on.has(r.id)}
                aria-label={r.what}
                disabled={busy === r.id}
                onClick={() => toggle(r.id)}
                className={cx('mt-0.5 shrink-0 w-9 h-5 rounded-full transition-colors relative', on.has(r.id) ? 'bg-volt' : 'bg-ink-3 border border-line-2')}
              >
                <span className={cx('absolute top-0.5 w-4 h-4 rounded-full transition-all', on.has(r.id) ? 'left-[18px] bg-ink' : 'left-0.5 bg-bone-4')} />
              </button>
              <div className="min-w-0">
                {/*
                  A mark rather than a red label. Five red rows out of eight is
                  not a warning, it is a colour scheme — and the one row where a
                  wrong yes cannot be taken back stops standing out at all.
                */}
                <div className="text-[13.5px] font-semibold flex items-start gap-1.5">
                  {r.danger && <Icon name="alert" size={13} className="text-danger shrink-0 mt-[3px]" />}
                  <span>{r.what}</span>
                </div>
                {/* The label already names the harm — "can overwrite work
                    already on the remote", "where credentials are kept". A
                    blanket "cannot be undone" under it would be wrong on at
                    least two of these, and a warning that is wrong once is a
                    warning nobody reads twice. */}
                {r.scope && <div className="text-[12px] text-bone-4 leading-snug mt-0.5">Covers {r.scope}.</div>}
              </div>
            </li>
          ))}
          {rules.length === 0 && <li className="py-3 text-[13px] text-bone-4">Loading…</li>}
        </ul>

        <div className="p-6 pt-4 shrink-0 border-t border-line flex items-end justify-between gap-4">
          <p className="text-[12px] leading-snug text-bone-4 max-w-[38ch]">
            Two things can never be allowed from here: formatting a disk, and killing Node by name —
            which would end Super Builds and this conversation with it.
          </p>
          <Button onClick={onClose}>Done</Button>
        </div>
      </div>
    </div>
  );
}
