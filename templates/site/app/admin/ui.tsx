/** The CRM's building blocks: KPI card, sparkline, funnel, stage pill, table, timeline. Server-renderable. */

import Link from 'next/link';
import type { Kpi } from './kpis';
import type { Lead, Activity } from '@/db/schema';
import { STAGES, stageFor } from '@/db/pipeline';

export function KpiCard({ k }: { k: Kpi }) {
  return (
    <div className="admin-card admin-kpi">
      <div className="admin-label">{k.label}</div>
      <div className="n">{k.value}</div>
      <div className="d flex items-center justify-between gap-2">
        <span style={{ color: k.good === false ? 'inherit' : 'var(--accent)' }}>{k.delta ?? ''}</span>
        <span style={{ opacity: .6 }}>{k.target ?? ''}</span>
      </div>
      {k.spark && k.spark.length > 1 && <Sparkline data={k.spark} />}
    </div>
  );
}

export function Sparkline({ data }: { data: number[] }) {
  const max = Math.max(1, ...data); const w = 200, h = 36;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - (v / max) * (h - 4) - 2}`).join(' ');
  return (
    <svg className="admin-spark mt-3" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <polyline points={pts} fill="none" stroke="var(--accent)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function Funnel({ steps }: { steps: Array<{ label: string; n: number }> }) {
  const max = Math.max(1, ...steps.map((s) => s.n));
  return (
    <div className="admin-funnel grid gap-2">
      {steps.map((s, i) => (
        <div key={s.label} className="grid grid-cols-[140px_1fr_60px] items-center gap-3 text-sm">
          <span className="truncate opacity-80">{s.label}</span>
          <div className="relative h-[30px]"><div className="bar" style={{ transform: `scaleX(${Math.max(0.02, s.n / max)})`, opacity: 1 - i * 0.12 }} /></div>
          <span className="font-mono text-right">{s.n}</span>
        </div>
      ))}
    </div>
  );
}

export function StagePill({ id }: { id: string }) {
  const s = stageFor(id);
  return <span className={`admin-pill ${s.won ? 'is-won' : ''}`}><span style={{ width: 6, height: 6, borderRadius: 3, background: s.won ? 'var(--accent)' : s.lost ? 'var(--muted)' : 'currentColor', opacity: s.lost ? .6 : 1 }} />{s.label}</span>;
}

export function ago(t: number): string {
  const d = Date.now() - t; const m = Math.round(d / 60000);
  if (m < 1) return 'just now'; if (m < 60) return `${m}m ago`; const h = Math.round(m / 60); if (h < 48) return `${h}h ago`; return `${Math.round(h / 24)}d ago`;
}

export function LeadsTable({ leads }: { leads: Lead[] }) {
  if (!leads.length) return <div className="admin-empty">No leads yet. When somebody sends a form on the site, they appear here with their stage, and you can move them along.</div>;
  return (
    <div className="admin-card overflow-x-auto">
      <table className="admin-table">
        <thead><tr><th>Who</th><th>Stage</th><th>Source</th><th>Message</th><th>Value</th><th>Updated</th></tr></thead>
        <tbody>
          {leads.map((l) => (
            <tr key={l.id}>
              <td><Link href={`/admin/leads/${l.id}`} className="font-medium underline-offset-4 hover:underline">{l.name || l.email || 'Lead'}</Link><div className="text-xs opacity-60">{l.email}{l.phone ? ` · ${l.phone}` : ''}{l.company ? ` · ${l.company}` : ''}</div></td>
              <td><StagePill id={l.stage} /></td>
              <td className="opacity-80">{l.source}</td>
              <td className="max-w-[360px]"><div className="line-clamp-2 opacity-80">{l.message}</div></td>
              <td className="font-mono">{l.value ? l.value.toLocaleString() : '—'}</td>
              <td className="opacity-60 whitespace-nowrap">{ago(l.updatedAt)}</td>
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
          <div className="text-sm">{a.leadName && <Link href={`/admin/leads/${a.leadId}`} className="font-medium hover:underline">{a.leadName}</Link>}{a.leadName ? ' — ' : ''}{a.text}</div>
          <div className="text-xs opacity-60 font-mono">{a.kind} · {a.by} · {ago(a.at)}</div>
        </li>
      ))}
    </ul>
  );
}

export { STAGES };
