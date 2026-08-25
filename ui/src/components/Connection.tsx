/**
 * The one place the interface admits it has lost the daemon.
 *
 * ── What it replaces ────────────────────────────────────────────────────────
 *
 * Two words in the corner of the header, red, `hidden md:inline`: "daemon
 * offline". It was accurate and it was the worst thing on the screen. It named
 * a process most people using this have never heard of, it offered nothing to
 * press, it did not say whether to wait or to do something, and on a phone it
 * did not appear at all — so the product simply stopped working with no
 * explanation anywhere.
 *
 * It was also, in the case that produced this file, wrong about the cause in a
 * way nobody could have guessed: the interface had moved to another port and
 * the daemon was refusing the socket on the old one.
 *
 * ── What it does instead ────────────────────────────────────────────────────
 *
 * Nothing at all while the connection is live, which is nearly always. A brief
 * moment's grace while it is coming up, because a badge that flashes on every
 * reload trains people to ignore it. And when it is genuinely down: a control
 * you can press, at every width, that opens the sentence the daemon's own
 * health check produced and one button that tries again.
 */

import { useEffect, useRef, useState } from 'react';
import { useStore, reconnect } from '@/lib/store';
import { Button, cx } from '@/components/ui';
import { Icon } from '@/components/icons';

export function Connection({ className }: { className?: string }) {
  const link = useStore((s) => s.link);
  const note = useStore((s) => s.linkNote);
  const tries = useStore((s) => s.linkTries);
  const [open, setOpen] = useState(false);
  const [patient, setPatient] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  /*
    A first connection takes a few milliseconds. Announcing it would put a
    flicker on every reload, and a badge that cries wolf on load is a badge
    nobody reads when it matters.
  */
  useEffect(() => {
    if (link !== 'connecting') { setPatient(false); return; }
    const id = setTimeout(() => setPatient(true), 1400);
    return () => clearTimeout(id);
  }, [link]);

  useEffect(() => { if (link === 'live') setOpen(false); }, [link]);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open]);

  if (link === 'live') return null;
  if (link === 'connecting' && !patient) return null;

  const down = link === 'down';

  return (
    <div ref={box} className={cx('relative', className)}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cx(
          'inline-flex items-center gap-2 h-8 px-2.5 rounded-lg text-[12.5px] border transition-colors',
          down
            ? 'border-danger/35 bg-[rgba(255,107,87,0.08)] text-danger hover:bg-[rgba(255,107,87,0.14)]'
            : 'border-line bg-ink-2 text-bone-3 hover:text-bone',
        )}
      >
        <span className={cx('w-[6px] h-[6px] rounded-full shrink-0', down ? 'bg-danger pulse-dot' : 'bg-warn pulse-dot')} />
        <span className="hidden sm:inline">{down ? 'Not connected' : 'Connecting'}</span>
      </button>

      {open && (
        <div className="panel fade absolute right-0 top-[calc(100%+8px)] w-[min(360px,calc(100vw-32px))] p-4 shadow-2xl shadow-black/60 z-[60]">
          <div className="flex items-start gap-2.5">
            <Icon name={down ? 'alert' : 'refresh'} size={15} className={cx('mt-0.5 shrink-0', down ? 'text-danger' : 'text-warn')} />
            <div className="min-w-0">
              <h3 className="text-[13.5px] font-semibold text-bone">
                {down ? 'The interface has lost its daemon.' : 'Reaching the daemon.'}
              </h3>
              <p className="text-[13px] leading-relaxed text-bone-2 mt-1.5">
                {/* The one command in the sentence is set as a command. It is a
                    thing to type, and prose is the wrong voice for that. */}
                {(note || (down ? 'Working out what happened.' : 'This takes a moment on a cold start.'))
                  .split(/(npm run dev)/)
                  .map((part, i) => (part === 'npm run dev'
                    ? <code key={i} className="font-[family-name:var(--font-mono)] text-[12.5px] text-bone bg-ink-4 rounded px-1 py-0.5">{part}</code>
                    : <span key={i}>{part}</span>))}
              </p>
            </div>
          </div>

          <p className="telemetry text-bone-4 mt-3">
            {tries > 0 ? `${tries} attempt${tries === 1 ? '' : 's'} · trying again on its own` : 'trying again on its own'}
          </p>

          <div className="flex items-center gap-2 mt-3.5">
            <Button size="sm" variant="primary" icon="refresh" onClick={() => { reconnect(); }}>Try now</Button>
            <Button size="sm" variant="quiet" onClick={() => window.location.reload()}>Reload the page</Button>
          </div>

          <p className="text-[12px] leading-relaxed text-bone-3 mt-3.5 pt-3 border-t border-line">
            Nothing is lost while this is down. Every conversation and every file
            is on disk, and whatever a build was doing carries on without the
            screen — this is only the live connection to it.
          </p>
        </div>
      )}
    </div>
  );
}
