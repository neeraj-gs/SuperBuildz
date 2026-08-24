/**
 * The CRM's charts. Server-rendered SVG, no library, no client JavaScript.
 *
 * ── Why hand-rolled ─────────────────────────────────────────────────────────
 *
 * A charting library is 60–200KB of client bundle to draw six shapes that are
 * twenty lines of SVG each, and it would arrive with a palette of its own that
 * has nothing to do with this site. Everything here is a server component: the
 * page ships as markup, there is nothing to hydrate, and the colours come from
 * the same CSS variables the rest of the site reads — so the dashboard follows
 * the theme, and follows the tune panel, without knowing either exists.
 *
 * ── The rules these follow ──────────────────────────────────────────────────
 *
 * One accent, so every scale is sequential: magnitude is lightness, identity is
 * a label, and there is no categorical palette to get wrong. Marks are thin,
 * lines are 2px, bars cap at 24px, area fills are a wash at ~12%, gridlines are
 * solid hairlines one step off the surface — never dashed. Values are labelled
 * selectively: the end of a line, the tip of a bar, the extreme — never every
 * point. Text wears text colour, never the series colour; a swatch beside it
 * carries the identity.
 *
 * And never a second y-axis. Two measures of different size are two charts
 * stacked on a shared x-scale, which is what `Trend` does.
 */

import type { ReactNode } from 'react';

/* ---------------------------------------------------------------------------
   Shared bits
--------------------------------------------------------------------------- */

const STEP = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'];

/** Compact for a tile, exact for a table. 1,284 · 12.9K · 1.2M */
export function compact(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (Math.abs(n) >= 10_000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K`;
  return n.toLocaleString();
}

/** Round a maximum up to something a person would write on an axis. */
function niceMax(v: number): number {
  if (v <= 0) return 1;
  const mag = 10 ** Math.floor(Math.log10(v));
  for (const s of [1, 1.5, 2, 2.5, 3, 4, 5, 7.5, 10]) if (v <= s * mag) return s * mag;
  return 10 * mag;
}

export function Figure({ title, note, children, right }: { title: string; note?: string; children: ReactNode; right?: ReactNode }) {
  return (
    <figure className="admin-card admin-figure">
      <figcaption>
        <span className="admin-figure-title">{title}</span>
        {right}
      </figcaption>
      {note && <p className="admin-figure-note">{note}</p>}
      {children}
    </figure>
  );
}

/** Identity, in text, beside a coloured mark. Never colour on its own. */
export function Legend({ items }: { items: Array<{ label: string; fill: string; value?: string }> }) {
  return (
    <ul className="admin-legend">
      {items.map((i) => (
        <li key={i.label}>
          <span className="k" style={{ background: i.fill }} aria-hidden />
          <span className="l">{i.label}</span>
          {i.value !== undefined && <span className="v">{i.value}</span>}
        </li>
      ))}
    </ul>
  );
}

/**
 * The table every chart is paired with.
 *
 * Not a fallback — a twin. It is what a screen reader reads, what somebody
 * copies into a spreadsheet, and the reason no value here is gated behind a
 * hover that a keyboard cannot produce.
 */
export function TableView({ head, rows, summary }: { head: string[]; rows: Array<Array<string | number>>; summary: string }) {
  if (!rows.length) return null;
  return (
    <details className="admin-table-view">
      <summary>{summary}</summary>
      <table className="admin-table">
        <thead><tr>{head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={j ? 'num' : undefined}>{typeof c === 'number' ? c.toLocaleString() : c}</td>)}</tr>)}
        </tbody>
      </table>
    </details>
  );
}

/* ---------------------------------------------------------------------------
   Trend: one measure over time, and optionally a second below it
--------------------------------------------------------------------------- */

export interface Point { label: string; value: number }

/**
 * An area chart for the headline measure, with a column chart beneath it for a
 * second measure on the same dates.
 *
 * Two plots rather than two y-axes, and that is the whole design. Views and
 * leads differ by two orders of magnitude; putting them on one plot with two
 * scales invents a correlation that is not in the data. Stacked, sharing the
 * x-scale, both are readable and neither lies.
 */
export function Trend({ primary, primaryLabel, secondary, secondaryLabel }: {
  primary: Point[]; primaryLabel: string; secondary?: Point[]; secondaryLabel?: string;
}) {
  if (primary.length < 2) return <Empty>Not enough days yet. This fills in as people visit.</Empty>;

  const W = 720, H = 150, HB = secondary ? 62 : 0, PAD = 8;
  const max = niceMax(Math.max(1, ...primary.map((p) => p.value)));
  const x = (i: number) => PAD + (i / (primary.length - 1)) * (W - PAD * 2);
  const y = (v: number) => H - PAD - (v / max) * (H - PAD * 2);

  const line = primary.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const area = `${line} L${x(primary.length - 1).toFixed(1)},${H - PAD} L${x(0).toFixed(1)},${H - PAD} Z`;

  const peak = primary.reduce((best, p, i) => (p.value > primary[best].value ? i : best), 0);
  const last = primary.length - 1;
  const smax = secondary ? niceMax(Math.max(1, ...secondary.map((p) => p.value))) : 1;

  return (
    <>
      <svg viewBox={`0 0 ${W} ${H + HB}`} className="admin-chart" role="img" aria-label={`${primaryLabel} over ${primary.length} days`}>
        {/* A hairline at each quarter. Solid, one step off the surface, recessive. */}
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <line key={f} x1={PAD} x2={W - PAD} y1={y(max * f)} y2={y(max * f)} stroke="var(--chart-grid)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        ))}
        <path d={area} fill="var(--chart-accent)" opacity="0.12" />
        <path d={line} fill="none" stroke="var(--chart-accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />

        {/* Two dots and two numbers: the peak and the latest. Never every point. */}
        {[peak, last].filter((i, n, all) => all.indexOf(i) === n).map((i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(primary[i].value)} r="4.5" fill="var(--chart-accent)" stroke="var(--surface)" strokeWidth="2" />
            <text x={Math.min(W - PAD - 14, Math.max(PAD + 14, x(i)))} y={Math.max(12, y(primary[i].value) - 10)} className="admin-chart-value" textAnchor="middle">
              {compact(primary[i].value)}
            </text>
          </g>
        ))}

        {secondary && (
          <g transform={`translate(0 ${H})`}>
            <line x1={PAD} x2={W - PAD} y1={HB - 12} y2={HB - 12} stroke="var(--chart-grid)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            {secondary.map((p, i) => {
              // A 2px gap in the surface colour separates neighbours; nothing is
              // stroked to keep them apart.
              const slot = (W - PAD * 2) / secondary.length;
              const w = Math.max(2, Math.min(24, slot - 2));
              const h = p.value ? Math.max(2, (p.value / smax) * (HB - 22)) : 0;
              return h ? <rect key={i} x={PAD + i * slot + (slot - w) / 2} y={HB - 12 - h} width={w} height={h} rx={Math.min(4, w / 2)} fill="var(--chart-3)" /> : null;
            })}
          </g>
        )}
      </svg>

      <div className="admin-chart-x">
        <span>{primary[0].label}</span>
        {primary.length > 6 && <span>{primary[Math.floor(last / 2)].label}</span>}
        <span>{primary[last].label}</span>
      </div>

      <Legend items={[
        { label: primaryLabel, fill: 'var(--chart-accent)', value: compact(primary.reduce((n, p) => n + p.value, 0)) },
        ...(secondary && secondaryLabel ? [{ label: secondaryLabel, fill: 'var(--chart-3)', value: compact(secondary.reduce((n, p) => n + p.value, 0)) }] : []),
      ]} />

      <TableView
        summary={`${primary.length} days as a table`}
        head={['Day', primaryLabel, ...(secondaryLabel ? [secondaryLabel] : [])]}
        rows={primary.map((p, i) => [p.label, p.value, ...(secondary ? [secondary[i]?.value ?? 0] : [])])}
      />
    </>
  );
}

/* ---------------------------------------------------------------------------
   Ranked bars: one colour, because rank is already the bar's length
--------------------------------------------------------------------------- */

/**
 * Horizontal bars for "which of these is biggest".
 *
 * One colour for every bar, deliberately. Shading them darker-where-bigger
 * would double-encode the length as hue and spend the only free channel on
 * information the chart already shows. Horizontal because these labels are page
 * paths and domain names, and those do not fit under a column.
 */
export function Ranked({ rows, unit = '', max: given, emphasis }: {
  rows: Array<{ label: string; value: number; href?: string }>;
  unit?: string;
  max?: number;
  /** The one row the story is about, if there is one. The rest recede. */
  emphasis?: string;
}) {
  if (!rows.length) return <Empty>Nothing here yet.</Empty>;
  const max = given ?? Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="admin-ranked">
      {rows.map((r) => {
        const on = !emphasis || r.label === emphasis;
        return (
          <li key={r.label}>
            <span className="l" title={r.label}>{r.href ? <a href={r.href}>{r.label}</a> : r.label}</span>
            <span className="t">
              <span className="b" style={{ width: `${Math.max(1.5, (r.value / max) * 100)}%`, background: on ? 'var(--chart-2)' : 'var(--chart-5)' }} />
            </span>
            <span className="v">{compact(r.value)}{unit}</span>
          </li>
        );
      })}
    </ul>
  );
}

/* ---------------------------------------------------------------------------
   Funnel: ordered, so the ramp is legal — and the drop is the point
--------------------------------------------------------------------------- */

export function Funnel({ steps }: { steps: Array<{ label: string; n: number }> }) {
  if (!steps.length || !steps[0].n) return <Empty>No events yet. They arrive as people visit the site.</Empty>;
  const top = Math.max(1, steps[0].n);
  return (
    <>
      <ol className="admin-funnel">
        {steps.map((s, i) => {
          const prev = i ? steps[i - 1].n : s.n;
          const drop = prev ? Math.round((1 - s.n / prev) * 100) : 0;
          return (
            <li key={s.label}>
              <span className="l">{s.label}</span>
              <span className="t"><span className="b" style={{ width: `${Math.max(1.5, (s.n / top) * 100)}%`, background: STEP[Math.min(i, STEP.length - 1)] }} /></span>
              <span className="v">{compact(s.n)}</span>
              {/*
                The number worth reading is the one that left, not the one that
                stayed. A step that grows is unusual but real — somebody scrolls
                back up, an event fires twice — and saying so beats an em dash
                that reads as missing data.
              */}
              <span className="d">{i === 0 ? `${Math.round((s.n / top) * 100)}%` : drop > 0 ? `−${drop}%` : drop < 0 ? `+${-drop}%` : 'same'}</span>
            </li>
          );
        })}
      </ol>
      <TableView summary="The funnel as a table" head={['Step', 'People', 'Share of the top']} rows={steps.map((s) => [s.label, s.n, `${Math.round((s.n / top) * 100)}%`])} />
    </>
  );
}

/* ---------------------------------------------------------------------------
   Share: part-to-whole, ordered by size so the ramp means something
--------------------------------------------------------------------------- */

/**
 * A stacked bar rather than a donut.
 *
 * A donut is only honest at a glance and only up to about six segments, and it
 * cannot carry the labels these categories need. A stacked bar can, ranks them
 * by construction, and the segments sit in size order — which is what makes the
 * ramp an ordinal scale rather than a value-ramp on nominal categories.
 */
export function Share({ parts, total }: { parts: Array<{ label: string; value: number }>; total?: number }) {
  const sum = total ?? parts.reduce((n, p) => n + p.value, 0);
  if (!sum) return <Empty>Nothing to split yet.</Empty>;
  const ordered = [...parts].sort((a, b) => b.value - a.value).slice(0, 5);
  const rest = sum - ordered.reduce((n, p) => n + p.value, 0);
  const shown = rest > 0 ? [...ordered, { label: 'Everything else', value: rest }] : ordered;

  return (
    <>
      <div className="admin-share" role="img" aria-label={shown.map((p) => `${p.label} ${Math.round((p.value / sum) * 100)}%`).join(', ')}>
        {shown.map((p, i) => (
          <span key={p.label} style={{ flexGrow: p.value, background: STEP[Math.min(i, STEP.length - 1)] }} />
        ))}
      </div>
      <Legend items={shown.map((p, i) => ({
        label: p.label,
        fill: STEP[Math.min(i, STEP.length - 1)],
        value: `${Math.round((p.value / sum) * 100)}%`,
      }))} />
    </>
  );
}

/* ---------------------------------------------------------------------------
   Heatmap: the one place a real sequential scale is needed
--------------------------------------------------------------------------- */

/**
 * Seven rows by twenty-four columns: when people actually turn up.
 *
 * The only genuinely sequential chart here, and the only one with a scale
 * legend, because a colour that means a number has to say what number. Empty
 * cells are the surface itself rather than the faintest step, so "nobody" and
 * "one person" are visibly different states.
 */
export function Heatmap({ grid, max, days, note }: { grid: number[][]; max: number; days: string[]; note?: string }) {
  if (!max) return <Empty>{note ?? 'Not enough visits yet to see a pattern.'}</Empty>;
  const bands = 5;
  const bandOf = (v: number) => (v <= 0 ? -1 : Math.min(bands - 1, Math.floor(((v - 1) / max) * bands)));
  return (
    <>
      <div className="admin-heat">
        <div className="rows">
          {grid.map((row, d) => (
            <div key={d} className="row">
              <span className="d">{days[d]}</span>
              <div className="cells">
                {row.map((v, h) => {
                  const b = bandOf(v);
                  return (
                    <span
                      key={h}
                      className={`c${b < 0 ? ' is-empty' : ''}`}
                      title={`${days[d]} ${String(h).padStart(2, '0')}:00 — ${v} visit${v === 1 ? '' : 's'}`}
                      style={b < 0 ? undefined : { background: STEP[bands - 1 - b] }}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="hours"><span>00</span><span>06</span><span>12</span><span>18</span><span>23</span></div>
      </div>
      <div className="admin-scale">
        <span>none</span>
        {Array.from({ length: bands }, (_, i) => <span key={i} className="s" style={{ background: STEP[bands - 1 - i] }} />)}
        <span>{max}+</span>
      </div>
    </>
  );
}

/* ---------------------------------------------------------------------------
   Figures: when the form is a number, not a chart
--------------------------------------------------------------------------- */

export interface Stat {
  id: string;
  label: string;
  value: string;
  /** Signed, against a named period. */
  delta?: string;
  /** Whether up is good here. A rising no-show rate is not good news. */
  good?: boolean;
  target?: string;
  spark?: number[];
  hint?: string;
}

export function StatTile({ s }: { s: Stat }) {
  const tone = s.delta === undefined ? undefined : s.good === false ? 'var(--chart-bad)' : 'var(--chart-good)';
  return (
    <div className="admin-card admin-kpi">
      <div className="admin-kpi-label">{s.label}</div>
      <div className="n">{s.value}</div>
      <div className="d">
        {s.delta !== undefined && (
          <span className="c" style={{ color: tone }}>
            {/* A shape as well as a colour: direction has to survive colour blindness. */}
            <span className={`a ${s.good === false ? 'down' : 'up'}`} aria-hidden />
            {s.delta}
          </span>
        )}
        {s.target && <span className="t">{s.target}</span>}
      </div>
      {s.hint && <div className="h">{s.hint}</div>}
      {s.spark && s.spark.length > 1 && <Sparkline data={s.spark} />}
    </div>
  );
}

export function Sparkline({ data }: { data: number[] }) {
  const max = Math.max(1, ...data);
  const w = 200, h = 30;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - (v / max) * (h - 3) - 1.5}`);
  return (
    <svg className="admin-spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <polyline points={pts.join(' ')} fill="none" stroke="var(--chart-accent)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/**
 * One ratio against a limit.
 *
 * The unfilled track is a faint step of the same ramp rather than a grey, so the
 * whole bar reads as one scale and the state is legible across it.
 */
export function Meter({ value, of, label, good }: { value: number; of: number; label: string; good?: boolean }) {
  const pct = of ? Math.min(100, Math.round((value / of) * 100)) : 0;
  return (
    <div className="admin-meter">
      <div className="admin-meter-head"><span>{label}</span><span className="v">{pct}%</span></div>
      <div className="t" role="img" aria-label={`${label}: ${pct}%`}>
        <span className="b" style={{ width: `${Math.max(1, pct)}%`, background: good === false ? 'var(--chart-bad)' : 'var(--chart-accent)' }} />
      </div>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="admin-empty">{children}</div>;
}
