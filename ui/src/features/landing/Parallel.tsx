/**
 * Several projects at once, and the notebook they share — shown running.
 *
 * ── Why this is a working board and not three bullet points ────────────────
 *
 * "Parallel sessions" is a phrase that means nothing until you watch one
 * conversation finish and the queued one start on its own. So this is the
 * actual tab bar, the actual queue line and the actual notebook, on a script
 * that plays whether or not anybody presses anything. A person scrolling past
 * sees a machine working; a person who stops can read what each conversation
 * is doing and what the notebook has just written down.
 *
 * The script is fixed rather than random. Random motion is noise you learn to
 * ignore; a sequence that always tells the same short story — three projects
 * open, four conversations, one waiting because the machine is full, and one
 * line of shared memory written every time a turn finishes — is a
 * demonstration.
 */

import { useEffect, useReducer, useState } from 'react';
import { cx } from '@/components/ui';
import { Icon } from '@/components/icons';

interface Conversation { name: string; doing: string; state: 'running' | 'idle' | 'queued'; queue?: number }
interface Project { name: string; kind: string; tabs: Conversation[]; note?: string }

/** Six beats, then back to the start. Each beat is one thing changing. */
const BEATS: Array<{ projects: Project[]; wrote?: string; caption: string }> = [
  {
    caption: 'Three projects open. Four conversations between them.',
    projects: [
      { name: 'Ember and Oak', kind: 'restaurant', tabs: [{ name: 'Menu page', doing: 'rewriting it around the tasting menu', state: 'running' }, { name: 'Colours', doing: 'three ways', state: 'idle' }] },
      { name: 'Harbour Dental', kind: 'clinic', tabs: [{ name: 'Booking form', doing: 'the form that never worked on phones', state: 'running' }] },
      { name: 'Studio Nine', kind: 'portfolio', tabs: [{ name: 'The case studies', doing: 'nine of them, one scroll', state: 'idle' }] },
    ],
  },
  {
    caption: 'A fourth message goes in while two are already running.',
    projects: [
      { name: 'Ember and Oak', kind: 'restaurant', tabs: [{ name: 'Menu page', doing: 'rewriting it around the tasting menu', state: 'running' }, { name: 'Colours', doing: 'trying the palette three ways', state: 'running' }] },
      { name: 'Harbour Dental', kind: 'clinic', tabs: [{ name: 'Booking form', doing: 'the form that never worked on phones', state: 'running' }] },
      { name: 'Studio Nine', kind: 'portfolio', tabs: [{ name: 'The case studies', doing: 'waiting for a slot', state: 'queued', queue: 1 }] },
    ],
  },
  {
    caption: 'The menu page finishes. It writes one line into the notebook.',
    wrote: '**Menu page** · rewrote the menu around the six-seat counter.',
    projects: [
      { name: 'Ember and Oak', kind: 'restaurant', tabs: [{ name: 'Menu page', doing: 'done — 41s', state: 'idle' }, { name: 'Colours', doing: 'trying the palette three ways', state: 'running' }] },
      { name: 'Harbour Dental', kind: 'clinic', tabs: [{ name: 'Booking form', doing: 'the form that never worked on phones', state: 'running' }] },
      { name: 'Studio Nine', kind: 'portfolio', tabs: [{ name: 'The case studies', doing: 'starting now', state: 'running' }] },
    ],
  },
  {
    caption: 'The colours conversation reads that line before it answers.',
    projects: [
      { name: 'Ember and Oak', kind: 'restaurant', tabs: [{ name: 'Menu page', doing: 'done — 41s', state: 'idle' }, { name: 'Colours', doing: 'keeping the counter photograph legible', state: 'running' }], note: 'reading the notebook' },
      { name: 'Harbour Dental', kind: 'clinic', tabs: [{ name: 'Booking form', doing: 'testing it at 390px', state: 'running' }] },
      { name: 'Studio Nine', kind: 'portfolio', tabs: [{ name: 'The case studies', doing: 'nine of them, one scroll', state: 'running' }] },
    ],
  },
  {
    caption: 'Nothing waited on anything else. Every folder is its own git repository.',
    wrote: '**Booking form** · the form works on a phone; nothing else was touched.',
    projects: [
      { name: 'Ember and Oak', kind: 'restaurant', tabs: [{ name: 'Menu page', doing: 'done — 41s', state: 'idle' }, { name: 'Colours', doing: 'done — 1m 04s', state: 'idle' }] },
      { name: 'Harbour Dental', kind: 'clinic', tabs: [{ name: 'Booking form', doing: 'done — 58s', state: 'idle' }] },
      { name: 'Studio Nine', kind: 'portfolio', tabs: [{ name: 'The case studies', doing: 'still going', state: 'running' }] },
    ],
  },
];

export function Parallel() {
  const [beat, next] = useReducer((n: number) => (n + 1) % BEATS.length, 0);
  const [live, setLive] = useState(true);

  useEffect(() => {
    if (!live) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;
    const id = setInterval(next, 2800);
    return () => clearInterval(id);
  }, [live]);

  const now = BEATS[beat];
  // The notebook keeps every line written up to this point in the loop.
  const written = BEATS.slice(0, beat + 1).map((b) => b.wrote).filter(Boolean) as string[];
  const running = now.projects.flatMap((p) => p.tabs).filter((t) => t.state === 'running').length;
  const waiting = now.projects.flatMap((p) => p.tabs).filter((t) => t.state === 'queued').length;

  return (
    <div
      className="panel overflow-hidden noise relative bg-ink-2/80 backdrop-blur-sm"
      onMouseEnter={() => setLive(false)}
      onMouseLeave={() => setLive(true)}
    >
      <header className="flex flex-wrap items-center justify-between gap-3 px-4 h-11 border-b border-line">
        <span className="telemetry text-bone-3">{running} running · {waiting ? `${waiting} waiting` : 'nothing waiting'} · ceiling 3 on this machine</span>
        <span className="telemetry text-bone-4 hidden sm:inline">{live ? 'playing — hover to hold' : 'held'}</span>
      </header>

      <div className="grid md:grid-cols-3 gap-px bg-line">
        {now.projects.map((p) => (
          <div key={p.name} className="bg-ink-2 p-3 min-h-[186px]">
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <span className="font-semibold text-[13.5px] truncate">{p.name}</span>
              <span className="telemetry text-bone-4 shrink-0">{p.kind}</span>
            </div>

            <div className="flex gap-1 mb-2.5">
              {p.tabs.map((t) => (
                <span
                  key={t.name}
                  className={cx(
                    'h-7 px-2.5 rounded-t-md text-[12px] inline-flex items-center gap-1.5 border border-b-0 min-w-0',
                    t.state === 'running' ? 'bg-ink-3 border-line text-bone' : 'border-transparent text-bone-3',
                  )}
                >
                  {t.state === 'running' && <span className="w-[6px] h-[6px] rounded-full bg-volt pulse-dot shrink-0" />}
                  {t.state === 'queued' && <span className="telemetry text-warn shrink-0">{t.queue}</span>}
                  {t.state === 'idle' && <span className="w-[6px] h-[6px] rounded-full bg-bone-4 shrink-0" />}
                  <span className="truncate">{t.name}</span>
                </span>
              ))}
            </div>

            <div className="rounded-lg border border-line bg-ink p-2.5 min-h-[74px]">
              {p.tabs.map((t) => (
                <p key={t.name} className="text-[12.5px] leading-snug text-bone-3 mb-1.5 last:mb-0">
                  <span className={cx(t.state === 'running' ? 'text-volt' : t.state === 'queued' ? 'text-warn' : 'text-bone-4')}>
                    {t.state === 'queued' ? 'in line' : t.state === 'running' ? 'now' : 'done'}
                  </span>{' '}
                  {t.doing}
                </p>
              ))}
            </div>

            {p.note && (
              <p className="telemetry text-volt mt-2 flex items-center gap-1.5">
                <Icon name="book" size={11} /> {p.note}
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="border-t border-line p-4">
        <div className="flex items-center justify-between gap-3 mb-2">
          <span className="legend">.superbuilds/memory.md — every conversation in a project reads this</span>
          <span className="telemetry text-bone-4 hidden md:inline">written by the daemon, not the model</span>
        </div>
        <div className="rounded-lg border border-line bg-ink px-3.5 py-3 min-h-[86px] font-[family-name:var(--font-mono)] text-[12px] leading-[1.7]">
          <p className="text-bone-3">We are a wine bar, not a restaurant. Never use the word artisanal.</p>
          {written.map((line, i) => (
            <p key={line} className={cx('text-bone-2 fade', i === written.length - 1 && 'text-bone')}>
              <span className="text-volt">·</span>{' '}
              {line.split('**').map((part, k) => (k % 2 ? <strong key={k} className="text-bone">{part}</strong> : part))}
            </p>
          ))}
          {!written.length && <p className="text-bone-4">…nothing written yet this run.</p>}
        </div>
        <p className="text-[13px] text-bone-2 mt-3 measure">{now.caption}</p>
      </div>
    </div>
  );
}
