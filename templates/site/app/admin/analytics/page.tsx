import { repo } from '@/db/repo';
import { Funnel, Sparkline } from '../ui';
import { currentAdmin } from '@/lib/auth';
import LoginPage from '../login/page';

export const dynamic = 'force-dynamic';

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  if (!(await currentAdmin())) return <LoginPage />;
  const days = Math.min(90, Math.max(1, Number((await searchParams).days ?? 30) || 30));
  const c = await repo.counts(Date.now() - days * 86400000);
  const names = Object.entries(c.byName).sort((a, b) => b[1] - a[1]);
  const paths = Object.entries(c.byPath);
  const refs = Object.entries(c.byRef);
  const depth = [25, 50, 75, 100].map((d) => ({ label: `${d}% of page`, n: 0 }));
  // Scroll depth lives in props; count it from recent events.
  const events = await repo.events(Date.now() - days * 86400000, 4000);
  for (const e of events) if (e.name === 'scroll_depth') { try { const p = JSON.parse(e.props) as { depth?: number }; const i = [25, 50, 75, 100].indexOf(Number(p.depth)); if (i >= 0) depth[i].n++; } catch {} }
  return (
    <div className="grid gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div><div className="admin-label">Analytics · built in</div><h1 className="font-display text-2xl mt-1">Last {days} days</h1></div>
        <div className="flex gap-2">{[7, 30, 90].map((d) => <a key={d} href={`/admin/analytics?days=${d}`} className={`admin-btn ${d === days ? 'is-on' : ''}`} style={d === days ? { borderColor: 'var(--accent)' } : undefined}>{d}d</a>)}</div>
      </header>
      {!c.events ? <div className="admin-empty">No events yet. The site sends page views, section views, scroll depth, CTA clicks and form events here as people visit. Other providers you chose (Vercel, PostHog…) show in their own dashboards.</div> : (
        <>
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[['Sessions', c.sessions], ['Page views', c.byName['page_view'] ?? 0], ['Events', c.events], ['Leads', c.leads]].map(([l, v]) => <div key={String(l)} className="admin-card admin-kpi"><div className="admin-label">{l}</div><div className="n">{v}</div></div>)}
          </section>
          <section className="admin-card p-5"><div className="admin-label mb-3">Page views per day</div><div style={{ height: 120 }}><Sparkline data={c.byDay.map((d) => d.views)} /></div><div className="flex justify-between text-xs opacity-60 font-mono"><span>{c.byDay[0]?.day}</span><span>{c.byDay.at(-1)?.day}</span></div></section>
          <section className="grid lg:grid-cols-3 gap-3">
            <div className="admin-card p-5"><div className="admin-label mb-3">Events</div><Funnel steps={names.slice(0, 10).map(([n, v]) => ({ label: n.replace(/_/g, ' '), n: v }))} /></div>
            <div className="admin-card p-5"><div className="admin-label mb-3">Pages</div><Funnel steps={paths.slice(0, 10).map(([n, v]) => ({ label: n || '/', n: v }))} /></div>
            <div className="admin-card p-5"><div className="admin-label mb-3">Scroll depth</div><Funnel steps={depth} /><div className="admin-label mt-6 mb-3">Referrers</div>{refs.length ? <Funnel steps={refs.slice(0, 8).map(([n, v]) => ({ label: n, n: v }))} /> : <div className="text-sm opacity-60">Direct only, so far.</div>}</div>
          </section>
        </>
      )}
    </div>
  );
}
