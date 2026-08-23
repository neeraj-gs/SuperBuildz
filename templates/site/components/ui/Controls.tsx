'use client';

/**
 * Form controls that belong to the site.
 *
 * A native `<select>` renders the operating system's widget and a native
 * `<input type="date">` renders the operating system's calendar *in the
 * operating system's locale* — so a restaurant in Lisbon asks for a booking
 * in `mm/dd/yyyy`. Both break the design language of an otherwise considered
 * page at exactly the moment the visitor is being asked to commit, which is
 * the worst possible place to lose them.
 *
 * These are keyboard-complete, announce themselves to a screen reader, write
 * a plain hidden input so the existing form posting is unchanged, and inherit
 * every token. Dates are formatted with `Intl` in the site's own locale and
 * submitted as ISO, so the server never has to guess.
 */

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { design } from '@/design.config';

const LOCALE = (design as { locale?: string }).locale ?? 'en-GB';

/* --------------------------------------------------------------- Select -- */

export function Select({
  name, options, value, onChange, placeholder = 'Choose', required, id,
}: {
  name: string; options: string[]; value?: string; onChange?: (v: string) => void;
  placeholder?: string; required?: boolean; id?: string;
}) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState(value ?? '');
  const [active, setActive] = useState(0);
  const host = useRef<HTMLDivElement>(null);
  const listId = useId();
  const btnId = id ?? useId();

  useEffect(() => { if (value !== undefined) setCurrent(value); }, [value]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!host.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const pick = (v: string) => { setCurrent(v); onChange?.(v); setOpen(false); host.current?.querySelector('button')?.focus(); };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setOpen(false); return; }
    if (!open && (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown')) { e.preventDefault(); setOpen(true); return; }
    if (!open) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(options.length - 1, i + 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    if (e.key === 'Enter') { e.preventDefault(); pick(options[active]); }
    if (e.key === 'Home') { e.preventDefault(); setActive(0); }
    if (e.key === 'End') { e.preventDefault(); setActive(options.length - 1); }
  };

  return (
    <div ref={host} className="relative" onKeyDown={onKey}>
      <input type="hidden" name={name} value={current} required={required} />
      <button
        type="button"
        id={btnId}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => setOpen((o) => !o)}
        className="flex h-12 w-full items-center justify-between gap-3 rounded-[var(--radius)] border hairline bg-surface px-4 text-left transition-colors focus:border-accent focus:outline-none"
      >
        <span className={current ? '' : 'opacity-45'}>{current || placeholder}</span>
        <Chevron open={open} />
      </button>

      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-labelledby={btnId}
          className="absolute z-30 mt-2 max-h-64 w-full overflow-auto rounded-[var(--radius)] border hairline bg-bg p-1 shadow-2xl"
        >
          {options.map((o, i) => (
            <li key={o} role="option" aria-selected={o === current}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(o)}
                className="flex w-full items-center justify-between rounded-[calc(var(--radius)-3px)] px-3 py-2.5 text-left transition-colors"
                style={{
                  background: i === active ? 'color-mix(in oklab, var(--accent) 14%, transparent)' : 'transparent',
                  color: o === current ? 'var(--accent)' : 'inherit',
                }}
              >
                {o}
                {o === current && <Tick />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------- Date -- */

/**
 * A month grid in the site's own locale. Submits ISO (`YYYY-MM-DD`); shows
 * the date the way the visitor's country writes it.
 */
export function DateField({
  name, value, onChange, min, max, required, placeholder = 'Pick a date', disabledDays = [],
}: {
  name: string; value?: string; onChange?: (v: string) => void;
  min?: string; max?: string; required?: boolean; placeholder?: string;
  /** 0 = Sunday. Days the business is closed. */
  disabledDays?: number[];
}) {
  const [open, setOpen] = useState(false);
  const [iso, setIso] = useState(value ?? '');
  const today = useMemo(() => startOfDay(new Date()), []);
  const [view, setView] = useState(() => (value ? new Date(value) : today));
  const host = useRef<HTMLDivElement>(null);
  const gridId = useId();

  useEffect(() => { if (value !== undefined) setIso(value); }, [value]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!host.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const long = useMemo(() => new Intl.DateTimeFormat(LOCALE, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }), []);
  const monthName = useMemo(() => new Intl.DateTimeFormat(LOCALE, { month: 'long', year: 'numeric' }), []);
  const weekdays = useMemo(() => {
    const f = new Intl.DateTimeFormat(LOCALE, { weekday: 'short' });
    // Week starts Monday everywhere except the handful of locales that do not;
    // Intl has no first-day API in every runtime, so follow the region.
    const mondayFirst = !/^(en-US|en-CA|ja|he|pt-BR)/.test(LOCALE);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(Date.UTC(2024, 0, (mondayFirst ? 1 : 7) + i));
      return f.format(d);
    });
  }, []);

  const minD = min ? startOfDay(new Date(min)) : undefined;
  const maxD = max ? startOfDay(new Date(max)) : undefined;
  const blocked = (d: Date) =>
    (minD && d < minD) || (maxD && d > maxD) || disabledDays.includes(d.getDay());

  const days = useMemo(() => monthGrid(view, LOCALE), [view]);

  return (
    <div ref={host} className="relative">
      <input type="hidden" name={name} value={iso} required={required} />
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-12 w-full items-center justify-between gap-3 rounded-[var(--radius)] border hairline bg-surface px-4 text-left transition-colors focus:border-accent focus:outline-none"
      >
        <span className={iso ? '' : 'opacity-45'}>{iso ? long.format(new Date(iso)) : placeholder}</span>
        <CalendarMark />
      </button>

      {open && (
        <div role="dialog" aria-label="Choose a date" className="absolute z-30 mt-2 w-[19rem] rounded-[var(--radius)] border hairline bg-bg p-3 shadow-2xl">
          <div className="mb-2 flex items-center justify-between">
            <Step label="Previous month" onClick={() => setView(addMonths(view, -1))}><Chevron open={false} rotate={90} /></Step>
            <span className="eyebrow">{monthName.format(view)}</span>
            <Step label="Next month" onClick={() => setView(addMonths(view, 1))}><Chevron open={false} rotate={-90} /></Step>
          </div>
          <div className="grid grid-cols-7 gap-0.5" id={gridId}>
            {weekdays.map((w) => (
              <span key={w} className="eyebrow grid h-8 place-items-center opacity-45" style={{ fontSize: '0.62rem' }}>{w}</span>
            ))}
            {days.map(({ date, inMonth }) => {
              const key = toIso(date);
              const off = blocked(date);
              const on = key === iso;
              return (
                <button
                  key={key}
                  type="button"
                  disabled={off}
                  aria-current={on ? 'date' : undefined}
                  onClick={() => { setIso(key); onChange?.(key); setOpen(false); }}
                  className="grid h-9 place-items-center rounded-[calc(var(--radius)-4px)] text-sm transition-colors disabled:cursor-not-allowed"
                  style={{
                    opacity: off ? 0.22 : inMonth ? 1 : 0.4,
                    background: on ? 'var(--accent)' : 'transparent',
                    color: on ? 'var(--bg)' : undefined,
                    outline: !on && key === toIso(today) ? '1px solid color-mix(in oklab, var(--accent) 50%, transparent)' : undefined,
                  }}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------- bits -- */

function Step({ children, onClick, label }: { children: React.ReactNode; onClick: () => void; label: string }) {
  return (
    <button type="button" aria-label={label} onClick={onClick} className="grid h-8 w-8 place-items-center rounded-[var(--radius)] transition-colors hover:bg-surface">
      {children}
    </button>
  );
}

function Chevron({ open, rotate = 0 }: { open: boolean; rotate?: number }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
      style={{ transform: `rotate(${open ? 180 : rotate}deg)`, transition: 'transform 180ms var(--ease-out)', opacity: 0.6 }} aria-hidden>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function Tick() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function CalendarMark() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" style={{ opacity: 0.55 }} aria-hidden>
      <rect x="4" y="6" width="16" height="14" rx="2" /><path d="M4 10h16M9 4v4M15 4v4" />
    </svg>
  );
}

/* ---------------------------------------------------------------- dates -- */

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function addMonths(d: Date, n: number) { const x = new Date(d); x.setDate(1); x.setMonth(x.getMonth() + n); return x; }
function toIso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Six weeks covering the month, padded with the neighbouring days. */
function monthGrid(view: Date, locale: string) {
  const mondayFirst = !/^(en-US|en-CA|ja|he|pt-BR)/.test(locale);
  const first = new Date(view.getFullYear(), view.getMonth(), 1);
  const shift = mondayFirst ? (first.getDay() + 6) % 7 : first.getDay();
  const start = new Date(first);
  start.setDate(1 - shift);
  return Array.from({ length: 42 }, (_, i) => {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    return { date, inMonth: date.getMonth() === view.getMonth() };
  });
}
