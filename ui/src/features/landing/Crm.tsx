/**
 * The dashboard every generated site comes with, drawn to its own rules.
 *
 * ── Why the marks look like this ───────────────────────────────────────────
 *
 * The same rules the generated CRM is built to, because a drawing of it that
 * broke them would be advertising something else: one series and therefore no
 * legend, thin marks, a 2px line over a faint wash of the same colour, a
 * hairline baseline instead of a cage of gridlines, labels only where a number
 * is actually wanted, and every piece of *text* in a text colour — the colour
 * belongs to the mark, never to the writing beside it. Bars for pages are one
 * colour because "page" is a name, not a quantity; colouring them by rank
 * would encode the sort order twice.
 *
 * It is a drawing and it says so. What it is not is a screenshot of a demo
 * account with invented company logos in it.
 */

import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/icons';

/* Fourteen days of a small restaurant's traffic, with the shape a real week has. */
const DAYS = [128, 96, 104, 142, 188, 246, 214, 151, 118, 133, 176, 232, 291, 264];
const LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const PAGES: Array<[string, number]> = [
  ['/menu', 1840],
  ['/', 1512],
  ['/book', 903],
  ['/about', 412],
  ['/private-dining', 268],
];

const TILES: Array<[string, string, string]> = [
  ['New leads', '42', '18% on last week'],
  ['Bookings', '17', '6% on last week'],
  ['Median reply', '1.8h', '22% faster'],
  ['Won this month', '€12.4k', '31% on last month'],
];

export function Crm() {
  const [asTable, setAsTable] = useState(false);
  const [hover, setHover] = useState<number | null>(null);

  return (
    <div className="panel overflow-hidden noise relative bg-ink-2/80 backdrop-blur-sm">
      <header className="h-11 px-4 flex items-center justify-between gap-3 border-b border-line">
        <span className="telemetry text-bone-3 truncate">ember-and-oak.com<span className="text-volt">/admin</span></span>
        <button onClick={() => setAsTable((v) => !v)} className="telemetry text-bone-4 hover:text-bone shrink-0">
          {asTable ? 'show the charts' : 'read it as numbers'}
        </button>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-line">
        {TILES.map(([label, value, delta]) => (
          <div key={label} className="bg-ink-2 px-3.5 py-3">
            <div className="legend !text-[10px] truncate">{label}</div>
            <div className="d3 mt-1.5 num">{value}</div>
            <div className="telemetry text-bone-3 mt-1 flex items-center gap-1">
              <Icon name="arrowUp" size={11} className="text-volt shrink-0" />
              <span className="truncate">{delta}</span>
            </div>
          </div>
        ))}
      </div>

      {asTable ? (
        <Table />
      ) : (
        <div className="grid lg:grid-cols-[1.35fr_1fr] gap-px bg-line">
          <Trend hover={hover} setHover={setHover} />
          <Ranked />
        </div>
      )}

      <footer className="px-4 py-2.5 border-t border-line flex flex-wrap items-center justify-between gap-2">
        <span className="telemetry text-bone-4">drawn, not a screenshot · the real one has pipeline, activity, funnel and export</span>
        <span className="telemetry text-bone-4">SQLite here · Postgres on Vercel · no account either way</span>
      </footer>
    </div>
  );
}

/**
 * Visits per day.
 *
 * Columns for the days and a line over them would be two encodings of one
 * number, so it is one: a 2px line, a wash of the same colour beneath it, and
 * the weekend columns left as the only vertical marks. Two labels, not
 * fourteen — the peak and the day you are pointing at.
 */
function Trend({ hover, setHover }: { hover: number | null; setHover: (n: number | null) => void }) {
  const w = 560;
  const h = 190;
  const pad = { l: 4, r: 4, t: 26, b: 22 };
  const max = 320;
  const x = (i: number) => pad.l + (i / (DAYS.length - 1)) * (w - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - v / max) * (h - pad.t - pad.b);
  const line = DAYS.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = `${line} L${x(DAYS.length - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`;
  const peak = DAYS.indexOf(Math.max(...DAYS));
  const at = hover ?? peak;

  const ref = useRef<SVGSVGElement>(null);
  const move = (e: React.PointerEvent) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const p = ((e.clientX - r.left) / r.width) * w;
    setHover(Math.max(0, Math.min(DAYS.length - 1, Math.round(((p - pad.l) / (w - pad.l - pad.r)) * (DAYS.length - 1)))));
  };

  return (
    <figure className="bg-ink-2 p-3.5 m-0">
      <figcaption className="flex items-baseline justify-between gap-3 mb-2">
        <span className="text-[13px] text-bone-2">Visits, the last fourteen days</span>
        <span className="telemetry text-bone-4">{LABELS[at]} · <span className="text-bone-2 num">{DAYS[at]}</span></span>
      </figcaption>
      <svg
        ref={ref}
        viewBox={`0 0 ${w} ${h}`}
        className="w-full h-auto block touch-none"
        onPointerMove={move}
        onPointerLeave={() => setHover(null)}
        role="img"
        aria-label={`Visits per day for fourteen days, from ${DAYS[0]} to ${DAYS[DAYS.length - 1]}, peaking at ${DAYS[peak]}`}
      >
        {/* One hairline at the base. A grid of five would be a cage. */}
        <line x1={0} y1={y(0)} x2={w} y2={y(0)} stroke="var(--color-line-2)" strokeWidth={1} />
        <path d={area} fill="var(--color-volt)" opacity={0.12} />
        <path d={line} fill="none" stroke="var(--color-volt)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <line x1={x(at)} y1={pad.t - 8} x2={x(at)} y2={y(0)} stroke="var(--color-line-3)" strokeWidth={1} />
        <circle cx={x(at)} cy={y(DAYS[at])} r={4} fill="var(--color-volt)" stroke="var(--color-ink-2)" strokeWidth={2} />
        <text x={x(at)} y={pad.t - 12} textAnchor={at > DAYS.length - 4 ? 'end' : at < 3 ? 'start' : 'middle'} className="fill-[color:var(--color-bone)] text-[13px] font-medium num">{DAYS[at]}</text>
        {[0, 6, 13].map((i) => (
          <text key={i} x={x(i)} y={h - 6} textAnchor={i === 0 ? 'start' : i === 13 ? 'end' : 'middle'} className="fill-[color:var(--color-bone-4)] text-[11px]">{LABELS[i]}</text>
        ))}
      </svg>
    </figure>
  );
}

/** Which pages people actually read. One colour: a page is a name, not a quantity. */
function Ranked() {
  const [shown, setShown] = useState(false);
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setShown(true); io.disconnect(); } }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const max = PAGES[0][1];
  return (
    <figure ref={ref} className="bg-ink-2 p-3.5 m-0">
      <figcaption className="text-[13px] text-bone-2 mb-2.5">Where they went</figcaption>
      <ul className="grid gap-2.5">
        {PAGES.map(([path, n], i) => (
          <li key={path}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="telemetry text-bone-2 truncate">{path}</span>
              <span className="telemetry text-bone-3 num shrink-0">{n.toLocaleString()}</span>
            </div>
            <div className="mt-1 h-[7px] rounded-[3px] bg-ink overflow-hidden">
              {/* The bar grows on the compositor: a full-width span scaled from
                  its left edge, rather than an animated `width`, which would
                  relayout the row on every frame of the reveal. */}
              <div className="h-full rounded-r-[4px] bg-volt origin-left" style={{ width: `${(n / max) * 100}%`, transform: `scaleX(${shown ? 1 : 0})`, transition: `transform 900ms var(--sb-ease) ${i * 70}ms` }} />
            </div>
          </li>
        ))}
      </ul>
    </figure>
  );
}

/** The same numbers, as numbers. Every figure in the real CRM has this. */
function Table() {
  return (
    <div className="p-3.5 overflow-x-auto">
      <table className="w-full text-[12.5px] border-collapse">
        <caption className="text-left text-[13px] text-bone-2 mb-2">Visits per day, and the five most-read pages</caption>
        <thead>
          <tr className="text-bone-4">
            <th scope="col" className="text-left font-normal legend !text-[10px] py-1">Day</th>
            <th scope="col" className="text-right font-normal legend !text-[10px] py-1">Visits</th>
            <th scope="col" className="text-left font-normal legend !text-[10px] py-1 pl-6">Page</th>
            <th scope="col" className="text-right font-normal legend !text-[10px] py-1">Reads</th>
          </tr>
        </thead>
        <tbody className="text-bone-2">
          {DAYS.map((v, i) => (
            <tr key={i} className="border-t border-line">
              <td className="py-1 telemetry text-bone-3">{LABELS[i]} {i < 7 ? 'w1' : 'w2'}</td>
              <td className="py-1 text-right num">{v}</td>
              <td className="py-1 pl-6 telemetry text-bone-3">{PAGES[i]?.[0] ?? ''}</td>
              <td className="py-1 text-right num">{PAGES[i] ? PAGES[i][1].toLocaleString() : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
