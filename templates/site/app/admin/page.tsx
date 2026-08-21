import Link from 'next/link';
import { repo } from '@/db/repo';
import { STAGES } from '@/db/pipeline';
import { kpis } from './kpis';
import { KpiCard, Funnel, Timeline, StagePill, ago } from './ui';
import { currentAdmin } from '@/lib/auth';
import LoginPage from './login/page';

export const dynamic = 'force-dynamic';

export default async function Overview() {
  if (!(await currentAdmin())) return <LoginPage />;
  const now = Date.now(), d30 = 30 * 86400000;
  const [cur, prev, recent, leads] = await Promise.all([repo.counts(now - d30), repo.counts(now - 2 * d30), repo.recentActivity(14), repo.leads({ limit: 8 })]);
  // Before-window counts: subtract the current window so the delta compares like with like.
  const before = { ...prev, leads: Math.max(0, prev.leads - cur.leads), byName: Object.fromEntries(Object.entries(prev.byName).map(([k, v]) => [k, Math.max(0, v - (cur.byName[k] ?? 0))])) } as typeof prev;
  const cards = kpis(cur, before, STAGES.filter((s) => s.won).map((s) => s.id));
  const funnelNames = ['page_view', 'section_view', 'cta_click', 'form_start', 'form_submit'];
  const funnel = funnelNames.map((n) => ({ label: n.replace('_', ' '), n: cur.byName[n] ?? 0 }));
  const pipeline = STAGES.filter((s) => !s.lost).map((s) => ({ stage: s, n: cur.byStage[s.id] ?? 0 }));

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div><div className="admin-label">Overview</div><h1 className="font-display text-2xl mt-1">Last 30 days</h1></div>
        <div className="flex gap-2"><Link href="/admin/leads" className="admin-btn">Leads</Link><a href="/api/admin/export" className="admin-btn">Export CSV</a></div>
      </header>
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">{cards.map((k) => <KpiCard key={k.id} k={k} />)}</section>
      <section className="grid lg:grid-cols-[1.2fr_1fr] gap-3">
        <div className="admin-card p-5">
          <div className="admin-label mb-4">Pipeline</div>
          <div className="grid gap-2">
            {pipeline.map(({ stage, n }) => (
              <Link key={stage.id} href={`/admin/leads?stage=${stage.id}`} className="flex items-center justify-between rounded-[var(--radius)] px-3 py-2 hover:bg-[color-mix(in_srgb,var(--fg)_4%,transparent)]">
                <StagePill id={stage.id} /><span className="font-mono">{n}</span>
              </Link>
            ))}
          </div>
        </div>
        <div className="admin-card p-5">
          <div className="admin-label mb-4">Funnel · from the site's own events</div>
          {cur.events ? <Funnel steps={funnel} /> : <div className="admin-empty">No events yet. They arrive as people visit the site.</div>}
        </div>
      </section>
      <section className="grid lg:grid-cols-2 gap-3">
        <div className="admin-card p-5"><div className="admin-label mb-4">Recent activity</div><Timeline items={recent} /></div>
        <div className="admin-card p-5">
          <div className="admin-label mb-4">Newest leads</div>
          {leads.length ? <ul className="grid gap-2">{leads.map((l) => <li key={l.id} className="flex items-center justify-between gap-3"><Link href={`/admin/leads/${l.id}`} className="font-medium hover:underline truncate">{l.name || l.email || 'Lead'}</Link><span className="flex items-center gap-2 text-xs opacity-70"><StagePill id={l.stage} />{ago(l.createdAt)}</span></li>)}</ul> : <div className="admin-empty">The first form submission lands here.</div>}
        </div>
      </section>
    </div>
  );
}
