/**
 * The CRM's small pieces: a stage pill, a lead table, a timeline, and the two
 * formatters everything else leans on.
 *
 * The charts live in `charts.tsx`; this is what is left — the parts that are
 * about a lead rather than about a number. Everything is server-renderable, and
 * everything reads the site's own CSS variables, which is how the dashboard
 * stays in the identity somebody chose for the front page.
 */

import Link from 'next/link';
import type { Lead, Activity } from '@/db/schema';
import { STAGES, stageFor } from '@/db/pipeline';

export function StagePill({ id }: { id: string }) {
  const s = stageFor(id);
  return (
    <span className={`admin-pill${s.won ? ' is-won' : ''}${s.lost ? ' is-lost' : ''}`}>
      <span className="dot" aria-hidden />
      {s.label}
    </span>
  );
}

/** "just now", "4h ago", "3d ago". Precision nobody needs is precision nobody reads. */
export function ago(t: number): string {
  const d = Date.now() - t;
  const m = Math.round(d / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

/**
 * Money, in the business's own currency.
 *
 * Rounded to whole units and compacted past a thousand, because a pipeline
 * figure is a sense of scale rather than an invoice. Falls back to a plain
 * number if the runtime does not know the currency code rather than throwing on
 * a dashboard.
 */
export function money(n: number, locale = 'en-GB', currency = 'GBP'): string {
  if (!n) return '—';
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency', currency, maximumFractionDigits: 0,
      ...(Math.abs(n) >= 10_000 ? { notation: 'compact' as const } : {}),
    }).format(n);
  } catch { return n.toLocaleString(); }
}

export function LeadsTable({ leads, locale, currency }: { leads: Lead[]; locale?: string; currency?: string }) {
  if (!leads.length) {
    return <div className="admin-empty">No leads here. When somebody sends a form on the site they appear with their stage, and you can move them along.</div>;
  }
  return (
    <div className="admin-card admin-scroll-x">
      <table className="admin-table">
        <thead>
          <tr><th>Who</th><th>Stage</th><th>Came from</th><th>What they said</th><th className="num">Value</th><th>Updated</th></tr>
        </thead>
        <tbody>
          {leads.map((l) => (
            <tr key={l.id}>
              <td>
                <Link href={`/admin/leads/${l.id}`} className="admin-strong">{l.name || l.email || 'Lead'}</Link>
                <div className="admin-meta">{[l.email, l.phone, l.company].filter(Boolean).join(' · ')}</div>
              </td>
              <td><StagePill id={l.stage} /></td>
              <td className="admin-meta">{l.source}{l.page ? <div>{l.page}</div> : null}</td>
              <td className="admin-clamp">{l.message}</td>
              <td className="num">{l.value ? money(l.value, locale, currency) : '—'}</td>
              <td className="admin-meta nowrap">{ago(l.updatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Timeline({ items }: { items: Array<Activity & { leadName?: string; leadId: string }> }) {
  if (!items.length) return <div className="admin-empty">Nothing has happened yet.</div>;
  return (
    <ul className="admin-timeline">
      {items.map((a) => (
        <li key={a.id}>
          <div className="t">
            {a.leadName && <Link href={`/admin/leads/${a.leadId}`} className="admin-strong">{a.leadName}</Link>}
            {a.leadName ? ' — ' : ''}{a.text}
          </div>
          <div className="m">{a.kind} · {a.by} · {ago(a.at)}</div>
        </li>
      ))}
    </ul>
  );
}

export { STAGES };
