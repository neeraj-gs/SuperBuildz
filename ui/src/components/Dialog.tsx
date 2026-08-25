/**
 * The question the product asks when it needs an answer.
 *
 * ── Why this exists at all ──────────────────────────────────────────────────
 *
 * `window.confirm` was doing this job. It renders "127.0.0.1:5180 says" above
 * your sentence, it cannot show a name or a consequence with any weight, it
 * cannot be pressed with anything but its own two buttons, and it freezes the
 * whole tab while it waits — which matters here, because several conversations
 * may be mid-turn behind it. On a product whose entire claim is that a page
 * can be made to look like somebody meant it, the browser's own dialog is the
 * one screen that admits nobody looked.
 *
 * ── What it does that the browser's does not ────────────────────────────────
 *
 * It names the thing (the project, the conversation, the file) rather than
 * describing it, it lists what will actually happen in the same telemetry
 * voice the rest of the tool uses, and it makes the destructive answer look
 * destructive. Enter confirms, Escape cancels, the backdrop cancels, and
 * whichever control is safest holds focus when it opens.
 */

import { useEffect, useRef, useState } from 'react';
import { useStore, type Ask } from '@/lib/store';
import { Button, cx } from '@/components/ui';
import { Icon } from './icons';

export function Dialogs() {
  const dialogs = useStore((s) => s.dialogs);
  // One at a time: a stack of modals is a maze, and nothing here asks two
  // questions at once. The newest is the one in front of you.
  const top = dialogs[dialogs.length - 1];
  if (!top) return null;
  return <Dialog key={top.id} ask={top} />;
}

function Dialog({ ask }: { ask: Ask }) {
  const answer = useStore((s) => s.answer);
  const [text, setText] = useState(ask.input?.value ?? '');
  const inputRef = useRef<HTMLInputElement>(null);
  const okRef = useRef<HTMLButtonElement>(null);
  const asking = !!ask.input;

  const close = (v: string | boolean | null) => answer(ask.id, v);
  const confirm = () => close(asking ? text.trim() : true);
  const cancel = () => close(asking ? null : false);

  useEffect(() => {
    // The safe control takes focus. For a text question that is the field,
    // because typing is the point; for a destructive one it is deliberately
    // *not* the red button, so a stray Enter cannot delete anything.
    const t = setTimeout(() => (asking ? inputRef.current?.select() : ask.danger ? undefined : okRef.current?.focus()), 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); cancel(); }
      if (e.key === 'Enter' && !e.shiftKey && (asking || !ask.danger)) { e.preventDefault(); confirm(); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => { clearTimeout(t); window.removeEventListener('keydown', onKey, true); };
  }); // every render: `text` is read by confirm()

  const icon = ask.icon ?? (ask.danger ? 'alert' : asking ? 'edit' : 'help');

  return (
    <div
      className="fixed inset-0 z-[120] grid place-items-center p-4 fade bg-ink/70 backdrop-blur-[3px]"
      onMouseDown={(e) => { if (e.target === e.currentTarget) cancel(); }}
      role="dialog"
      aria-modal="true"
      aria-label={ask.title}
    >
      <div className="panel noise relative w-[min(460px,100%)] overflow-hidden shadow-2xl shadow-black/70 rise">
        <div className="p-5">
          <div className="flex items-start gap-3.5">
            <span className={cx('grid place-items-center w-9 h-9 rounded-lg shrink-0 border', ask.danger ? 'border-danger/30 bg-danger/10 text-danger' : 'border-line-2 bg-ink text-volt')}>
              <Icon name={icon} size={17} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="d4 leading-snug">{ask.title}</h2>
              {ask.body && <p className="text-[13.5px] leading-relaxed text-bone-2 mt-1.5">{ask.body}</p>}
            </div>
          </div>

          {ask.points && ask.points.length > 0 && (
            <ul className="mt-3.5 grid gap-1.5 pl-[50px]">
              {ask.points.map((p) => (
                <li key={p} className="telemetry text-bone-3 flex gap-2">
                  <span className="text-bone-4 shrink-0">·</span>{p}
                </li>
              ))}
            </ul>
          )}

          {asking && (
            <label className="block mt-4 pl-[50px]">
              {ask.input?.label && <span className="legend block mb-1.5">{ask.input.label}</span>}
              <input
                ref={inputRef}
                className="input"
                value={text}
                placeholder={ask.input?.placeholder}
                onChange={(e) => setText(e.target.value)}
                spellCheck={false}
              />
            </label>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-line bg-ink-3/50">
          <Button variant="quiet" onClick={cancel}>{ask.cancelLabel ?? 'Cancel'}</Button>
          <button
            ref={okRef}
            onClick={confirm}
            disabled={asking && !text.trim()}
            className={cx('btn', ask.danger ? 'btn-danger' : 'btn-primary')}
          >
            {ask.confirmLabel ?? (asking ? 'Save' : 'Yes')}
          </button>
        </div>
      </div>
    </div>
  );
}
