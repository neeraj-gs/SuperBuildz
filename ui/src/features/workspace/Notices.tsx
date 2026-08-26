/**
 * The sentence that needed a person, taken out of the paragraph it was in.
 *
 * ── The failure ─────────────────────────────────────────────────────────────
 *
 * A build produces forty minutes of prose and nobody reads all of it. The one
 * line that actually needed somebody — "those two pages read patient names and
 * phone numbers, so I put them behind the login; tell me if you wanted them
 * public" — arrived in the middle of a paragraph, in the same weight as
 * everything around it, and scrolled away. It had even been introduced with
 * "one thing I want to flag rather than bury". It was still buried, because
 * being in the transcript and being seen are different things.
 *
 * ── Two places, and only one of them is a control ───────────────────────────
 *
 * The first version drew the same card in both, and with a short conversation
 * you saw it twice in one screen, which reads as a bug rather than as emphasis.
 * So they have different jobs and different weights:
 *
 *   the shelf       above the composer. The thing you act on: the full card,
 *                   with the alternatives it was choosing between or the field
 *                   that fixes it. One at a time, most urgent first, with the
 *                   rest behind a count — a shelf that grows until it eats the
 *                   message box has replaced one problem with another.
 *
 *   the transcript  one quiet line where it happened, kept forever, including
 *                   after it is dealt with. It is the record, not the remote
 *                   control. Its whole job is that scrolling back still shows
 *                   what was said and when — and a record that rewrites itself
 *                   when somebody presses a button is not one.
 *
 * ── Why it is answered rather than dismissed ────────────────────────────────
 *
 * A `decision` carries the alternatives it was choosing between, so overruling
 * it is a press rather than a paragraph somebody has to compose. A `key` opens
 * the field. Only a `note` gets a bare acknowledgement, which is why the system
 * prompt tells Claude to use that one least.
 */

import { useState } from 'react';
import type { Notice, Session } from '@superbuilds/protocol';
import { api } from '@/lib/api';
import { toast, askForKeys } from '@/lib/store';
import { Button, cx } from '@/components/ui';
import { Icon } from '@/components/icons';

const LOOK: Record<Notice['kind'], { icon: string; tone: string; ring: string; label: string; rank: number }> = {
  blocked: { icon: 'alert', tone: 'text-danger', ring: 'border-danger/45 bg-danger/[0.07]', label: 'It cannot go on', rank: 0 },
  key: { icon: 'key', tone: 'text-warn', ring: 'border-warn/45 bg-warn/[0.07]', label: 'It needs a key', rank: 1 },
  decision: { icon: 'help', tone: 'text-volt', ring: 'border-volt/45 bg-volt/[0.06]', label: 'A choice it made for you', rank: 2 },
  note: { icon: 'pin', tone: 'text-bone-2', ring: 'border-line-2 bg-ink-2/80', label: 'Worth knowing', rank: 3 },
};

/** Everything in this conversation still waiting to be dealt with, worst first. */
export function openNotices(session: Session): Notice[] {
  const out: Notice[] = [];
  for (const t of session.turns) for (const n of t.notices ?? []) if (!n.done) out.push(n);
  // Stable within a kind, so the oldest of two equally urgent things is first:
  // one that has been waiting twenty minutes is not less true for having been
  // followed by another.
  return out.sort((a, b) => LOOK[a.kind].rank - LOOK[b.kind].rank);
}

export function NoticeShelf({ session, projectId }: { session: Session; projectId: string }) {
  const [all, setAll] = useState(false);
  const open = openNotices(session);
  if (!open.length) return null;

  const shown = all ? open : open.slice(0, 1);
  const rest = open.length - shown.length;

  return (
    <div className="px-3 pb-2 space-y-2 max-h-[46vh] overflow-y-auto">
      {rest > 0 && (
        <button onClick={() => setAll(true)} className="w-full text-left telemetry text-bone-3 hover:text-bone border border-line rounded-lg px-2.5 py-1.5 flex items-center gap-2">
          <Icon name="chevronDown" size={12} />
          {rest} more {rest === 1 ? 'thing is' : 'things are'} waiting on you
        </button>
      )}
      {shown.map((n) => <NoticeCard key={n.id} notice={n} sessionId={session.id} projectId={projectId} />)}
    </div>
  );
}

function NoticeCard({ notice, sessionId, projectId }: { notice: Notice; sessionId: string; projectId: string }) {
  const [busy, setBusy] = useState(false);
  const look = LOOK[notice.kind];

  const ack = async () => {
    setBusy(true);
    try { await api.ackNotice(sessionId, notice.id); } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  };

  const reply = async (text: string) => {
    setBusy(true);
    try {
      await api.turn(sessionId, text);
      // Answered by being answered: leaving it on the shelf after the reply has
      // gone would ask the same question twice.
      await api.ackNotice(sessionId, notice.id).catch(() => {});
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  };

  return (
    <div className={cx('rounded-xl border p-3.5 rise', look.ring)}>
      <div className="flex items-start gap-2.5">
        <Icon name={look.icon} size={15} className={cx('shrink-0 mt-0.5', look.tone)} />
        <div className="min-w-0 flex-1">
          <div className="legend !text-[10px] mb-1">{look.label}</div>
          <div className="font-semibold text-[13.5px] leading-snug">{notice.title}</div>
          {notice.body && <p className="text-[12.5px] leading-relaxed text-bone-3 mt-1.5">{notice.body}</p>}
          {notice.keys?.length ? (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {notice.keys.map((k) => <code key={k} className="telemetry text-bone-2 border border-line rounded px-1.5 py-0.5 break-all">{k}</code>)}
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mt-3">
        {notice.kind === 'key' && notice.keys?.length ? (
          <Button size="sm" variant="primary" icon="key" onClick={() => askForKeys(projectId, notice.keys)}>
            {notice.keys.length === 1 ? 'Add the key' : 'Add the keys'}
          </Button>
        ) : null}
        {notice.choices?.map((c) => (
          <button key={c} disabled={busy} onClick={() => reply(c)} className="chip !border-volt/50 text-[12.5px] disabled:opacity-50">
            <Icon name="arrowRight" size={12} className="text-volt" />{c}
          </button>
        ))}
        <span className="flex-1" />
        <Button size="sm" variant="quiet" busy={busy} onClick={ack}>
          {notice.kind === 'note' ? 'Got it' : 'Leave it'}
        </Button>
      </div>
    </div>
  );
}

/**
 * The record, in the transcript, where it happened.
 *
 * One line, quiet, and permanent — including once it is dealt with, when it
 * gains a tick rather than disappearing. The only thing it carries is the way
 * back to a key form, because "change the key I added last week" is a real
 * thing to want and the transcript is where somebody would look for it.
 */
export function TurnNotices({ notices, projectId }: { notices: Notice[]; projectId: string }) {
  return (
    <ul className="mt-2.5 space-y-1">
      {notices.map((n) => {
        const look = LOOK[n.kind];
        return (
          <li key={n.id} className={cx('rounded-lg border px-2.5 py-1.5 flex items-start gap-2', n.done ? 'border-line text-bone-4' : cx(look.ring, 'text-bone-2'))}>
            <Icon name={n.done ? 'check' : look.icon} size={12} className={cx('shrink-0 mt-1', n.done ? 'text-bone-4' : look.tone)} />
            <span className="text-[12.5px] leading-snug min-w-0">
              <span className="legend !text-[10px] mr-1.5">{look.label}</span>
              {n.title}
            </span>
            <span className="flex-1" />
            {n.kind === 'key' && n.keys?.length ? (
              <button onClick={() => askForKeys(projectId, n.keys)} className="telemetry text-volt hover:underline shrink-0 mt-0.5">
                {n.done ? 'change it' : 'add it'}
              </button>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
