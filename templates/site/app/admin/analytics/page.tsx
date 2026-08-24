import Link from 'next/link';
import { headers } from 'next/headers';
import { metrics } from '@/db/metrics';
import { repo } from '@/db/repo';
import { design } from '@/design.config';
import { currentAdmin } from '@/lib/auth';
import LoginPage from '../login/page';
import { Figure, Funnel, Heatmap, Ranked, Share, StatTile, Trend, TableView, compact, Empty, type Stat } from '../charts';
import { chosenProviders, dashboardUrl } from './providers';

export const dynamic = 'force-dynamic';

const RANGES = [7, 30, 90] as const;
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * Traffic, in detail.
 *
 * The overview answers "is anything happening"; this answers "what exactly".
 * Same window control, same charts, more of them — and one section that most
 * dashboards leave out: where the numbers are when they are not here. A site
 * wired to PostHog shows nothing useful on this page, and saying so with a link
 * is more useful than an empty panel.
 */
export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  if (!(await currentAdmin())) return <LoginPage />;

  const days = pickRange((await searchParams).days);
  const [m, events] = await Promise.all([
    metrics(days, design.locale ?? 'en-GB'),
    repo.events(Date.now() - days * 86400000, 6000),
  ]);

  const host = (await headers()).get('host') ?? undefined;
  const providers = chosenProviders();
  const elsewhere = providers.filter((p) => !p.builtin);

  /* Scroll depth lives in an event's props rather than its name. */
  const depth = [25, 50, 75, 100].map((d) => ({ label: `${d}% down the page`, n: 0 }));
  const named = new Map<string, number>();
  for (const e of events) {
    named.set(e.name, (named.get(e.name) ?? 0) + 1);
    if (e.name !== 'scroll_depth') continue;
    try {
      const i = [25, 50, 75, 100].indexOf(Number((JSON.parse(e.props) as { depth?: number }).depth));
      if (i >= 0) depth[i].n++;
    } catch { /* a malformed prop bag is not worth a broken page */ }
  }

  const perVisit = m.now.visitors ? m.now.views / m.now.visitors : 0;
  const reach = m.now.visitors ? (m.now.reachedForm / m.now.visitors) * 100 : 0;

  const stats: Stat[] = [
    { id: 'visitors', label: 'People', value: compact(m.now.visitors), spark: m.byDay.map((d) => d.visitors), hint: 'Distinct browsers over the window' },
    { id: 'views', label: 'Page views', value: compact(m.now.views), spark: m.byDay.map((d) => d.views) },
    { id: 'depth', label: 'Pages each', value: perVisit ? perVisit.toFixed(1) : '—', hint: 'More than one means they looked around' },
    { id: 'reach', label: 'Reached a form', value: `${reach.toFixed(1)}%`, hint: 'Started filling something in' },
  ];

  const nothing = !m.now.views && !events.length;

  return (
    <div className="admin-page">
      <header className="admin-hero">
        <div className="admin-hero-body">
          <div>
            <div className="admin-eyebrow">Analytics · counted on your own server</div>
            <h1 className="admin-title">The last {days} days</h1>
            <p className="admin-lede">
              No cookies and no third party: every number here was recorded by this site, into your
              own database, and has never left it.
            </p>
          </div>
          <nav className="admin-range" aria-label="Time range">
            {RANGES.map((d) => (
              <Link key={d} href={`/admin/analytics?days=${d}`} className={`admin-btn${d === days ? ' is-on' : ''}`} aria-current={d === days ? 'true' : undefined}>{d} days</Link>
            ))}
          </nav>
        </div>
      </header>

      {nothing ? (
        <Figure title="Nothing recorded yet">
          <Empty>
            The site sends page views, section views, scroll depth, presses and form events here as
            people visit. Open the site in another tab and this fills in.
          </Empty>
        </Figure>
      ) : (
        <>
          <section className="admin-grid-4" aria-label="Headline numbers">
            {stats.map((s) => <StatTile key={s.id} s={s} />)}
          </section>

          <Figure title="Traffic" note="Views above, the people behind them below. Two plots on one date scale, never two scales on one plot.">
            <Trend
              primary={m.byDay.map((d) => ({ label: d.label, value: d.views }))}
              primaryLabel="Page views"
              secondary={m.byDay.map((d) => ({ label: d.label, value: d.visitors }))}
              secondaryLabel="People"
            />
          </Figure>

          <section className="admin-grid-2">
            <Figure title="The journey" note="Each step is the number of people who got that far. The percentage is what left.">
              <Funnel steps={m.funnel} />
            </Figure>
            <Figure title="How far down they read" note="Recorded at each quarter of the page.">
              <Funnel steps={depth} />
            </Figure>
          </section>

          <section className="admin-grid-2">
            <Figure title="Which pages" note="One colour: the bar's length is already the ranking.">
              <Ranked rows={m.pages} />
            </Figure>
            <Figure title="Where they came from" note="The referrer their browser sent. Most people send none.">
              <Share parts={m.sources} />
              <TableView summary="Sources as a table" head={['Source', 'Views']} rows={m.sources.map((s) => [s.label, s.value])} />
            </Figure>
          </section>

          <Figure title="When they come" note="Page views by day and hour, in your own timezone.">
            <Heatmap grid={m.heat} max={m.heatMax} days={DAYS} />
          </Figure>

          <Figure title="Everything the site recorded" note="Every event name, in order of how often it fired.">
            <Ranked rows={[...named.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([label, value]) => ({ label: label.replace(/_/g, ' '), value }))} />
          </Figure>
        </>
      )}

      {elsewhere.length > 0 && (
        <Figure
          title="Your other analytics"
          note="These providers keep their numbers on their own servers, so they cannot be drawn here. One press takes you to each."
        >
          <ul className="admin-list">
            {elsewhere.map((p) => {
              const url = dashboardUrl(p, host);
              return (
                <li key={p.id}>
                  <span>
                    <span className="admin-strong">{p.label}</span>
                    <span className="admin-meta"> — {p.blurb}</span>
                  </span>
                  {url && <a className="admin-btn" href={url} target="_blank" rel="noreferrer">Open {p.label} ↗</a>}
                </li>
              );
            })}
          </ul>
        </Figure>
      )}
    </div>
  );
}

function pickRange(raw: string | undefined): number {
  const n = Number(raw);
  return (RANGES as readonly number[]).includes(n) ? n : 30;
}
