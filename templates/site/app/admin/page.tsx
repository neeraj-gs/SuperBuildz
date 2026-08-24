import Link from 'next/link';
import { metrics, change } from '@/db/metrics';
import { design } from '@/design.config';
import { repo } from '@/db/repo';
import { currentAdmin } from '@/lib/auth';
import LoginPage from './login/page';
import { AdminScene } from './AdminScene';
import { StagePill, Timeline, ago, money } from './ui';
import { Figure, Funnel, Heatmap, Meter, Ranked, Share, StatTile, Trend, compact, Empty, type Stat } from './charts';

export const dynamic = 'force-dynamic';

const RANGES = [7, 30, 90] as const;
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * The screen an owner opens twenty times a week.
 *
 * ── What it is for ──────────────────────────────────────────────────────────
 *
 * Two questions, in this order: *is anything happening*, and *is there anything
 * I have to do*. Everything above the fold answers the first; the pipeline, the
 * unanswered leads and the activity answer the second. Anything that answers
 * neither is further down or on another page.
 *
 * ── Why it looks like the site ──────────────────────────────────────────────
 *
 * Because it is the same business. It reads the same CSS variables the front
 * page does, so the colours, the type and the corners are the ones somebody
 * chose an hour ago, and the site's own 3D scene runs quietly behind the first
 * band. Every other dashboard a small owner logs into is a grey table that
 * could belong to anyone.
 *
 * The charts follow one rule that is worth stating: there is a single accent
 * here, so magnitude is carried by lightness and identity is carried by a
 * label. No chart has two y-axes, and no value is only reachable by hovering.
 */
export default async function Overview({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  if (!(await currentAdmin())) return <LoginPage />;

  const days = pickRange((await searchParams).days);
  const [m, recent] = await Promise.all([
    metrics(days, design.locale ?? 'en-GB'),
    repo.recentActivity(10),
  ]);

  const { now, before } = m;
  const conv = now.visitors ? (now.leads / now.visitors) * 100 : 0;
  const convBefore = before.visitors ? (before.leads / before.visitors) * 100 : 0;
  const winRate = now.won + now.lost ? (now.won / (now.won + now.lost)) * 100 : 0;
  const openPipeline = m.pipeline.filter((s) => !s.won && !s.lost);
  const nothingYet = !now.views && !now.leads;

  const stats: Stat[] = [
    tile('leads', 'Enquiries', now.leads, before.leads, m.byDay.map((d) => d.leads), 'Every form on the site lands here'),
    tile('visitors', 'People', now.visitors, before.visitors, m.byDay.map((d) => d.visitors), 'Distinct browsers, not page views'),
    tile('views', 'Page views', now.views, before.views, m.byDay.map((d) => d.views)),
    {
      id: 'conv',
      label: 'Visit → enquiry',
      value: `${conv.toFixed(1)}%`,
      ...(change(Math.round(conv * 10), Math.round(convBefore * 10)) ?? {}),
      ...deltaOf(conv, convBefore, true),
      target: 'good is 2%+',
      hint: 'The one number worth moving',
    },
  ];

  const second: Stat[] = [
    {
      id: 'reply',
      label: 'Time to first reply',
      value: m.medianResponseHours === null ? '—' : m.medianResponseHours < 1 ? `${Math.round(m.medianResponseHours * 60)}m` : `${m.medianResponseHours}h`,
      target: 'under 1h wins work',
      // Faster is better, so a rising number is bad news and says so.
      ...(m.medianResponseHours !== null && m.medianResponseHours > 1 ? { good: false, delta: 'slower than an hour' } : {}),
      hint: m.medianResponseHours === null ? 'Nobody has been replied to yet' : 'Median, from arriving to your first action',
    },
    { id: 'open', label: 'Open pipeline', value: money(openPipeline.reduce((n, s) => n + s.value, 0), design.locale, design.currency), hint: `${openPipeline.reduce((n, s) => n + s.n, 0)} still live` },
    { id: 'won', label: 'Won', value: String(now.won), ...deltaOf(now.won, before.won, true), target: winRate ? `${Math.round(winRate)}% of decided` : undefined },
    { id: 'stale', label: 'Waiting on you', value: String(m.stale.length), good: m.stale.length === 0, ...(m.stale.length ? { delta: 'over two days old' } : {}), hint: m.stale.length ? 'These go cold' : 'Nothing is going cold' },
  ];

  return (
    <div className="admin-page">
      <header className="admin-hero">
        <AdminScene />
        <div className="admin-hero-body">
          <div>
            <div className="admin-eyebrow">{design.name}</div>
            <h1 className="admin-title">{greeting()}</h1>
            <p className="admin-lede">
              {nothingYet
                ? 'Nothing has come in yet. The moment somebody visits the site, this fills in.'
                : `${compact(now.visitors)} ${now.visitors === 1 ? 'person' : 'people'} and ${compact(now.leads)} ${now.leads === 1 ? 'enquiry' : 'enquiries'} in the last ${days} days.`}
            </p>
          </div>
          <nav className="admin-range" aria-label="Time range">
            {RANGES.map((d) => (
              <Link key={d} href={`/admin?days=${d}`} className={`admin-btn${d === days ? ' is-on' : ''}`} aria-current={d === days ? 'true' : undefined}>{d} days</Link>
            ))}
            <a href="/api/admin/export" className="admin-btn">Export CSV</a>
          </nav>
        </div>
      </header>

      <section className="admin-grid-4" aria-label="Headline numbers">
        {stats.map((s) => <StatTile key={s.id} s={s} />)}
      </section>

      <section className="admin-grid-4" aria-label="What needs doing">
        {second.map((s) => <StatTile key={s.id} s={s} />)}
      </section>

      <Figure
        title={`Traffic and enquiries · ${days} days`}
        note="Two plots on one date scale rather than two scales on one plot — page views and enquiries differ by two orders of magnitude, and sharing an axis would invent a shape that is not in the data."
      >
        <Trend
          primary={m.byDay.map((d) => ({ label: d.label, value: d.views }))}
          primaryLabel="Page views"
          secondary={m.byDay.map((d) => ({ label: d.label, value: d.leads }))}
          secondaryLabel="Enquiries"
        />
      </Figure>

      <section className="admin-grid-2">
        <Figure title="The journey" note="Where people stop. The percentage is what left, not what stayed.">
          <Funnel steps={m.funnel} />
        </Figure>

        <Figure title="Pipeline" note="Everything live right now, by stage.">
          {m.pipeline.some((s) => s.n) ? (
            <>
              <ul className="admin-pipeline">
                {m.pipeline.map((s) => (
                  <li key={s.id}>
                    <Link href={`/admin/leads?stage=${s.id}`}>
                      <StagePill id={s.id} />
                      <span className="n">{s.n}</span>
                      {s.value > 0 && <span className="v">{money(s.value, design.locale, design.currency)}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
              <Meter
                label="Of everything decided, won"
                value={now.won}
                of={Math.max(1, now.won + now.lost)}
                good={winRate >= 30}
              />
            </>
          ) : <Empty>The first form submission lands here.</Empty>}
        </Figure>
      </section>

      <section className="admin-grid-2">
        <Figure title="When people come" note="Page views by day and hour, in your own timezone. The dark cells are when it is worth being at the phone.">
          <Heatmap grid={m.heat} max={m.heatMax} days={DAYS} />
        </Figure>

        <Figure title="Where they come from" note="The referrer their browser sent. Most people arrive with none, which is what 'typed or bookmarked' means.">
          <Share parts={m.sources} />
          <div className="admin-sub">
            <div className="admin-figure-title">Which page they landed on</div>
            <Ranked rows={m.pages.slice(0, 6).map((p) => ({ label: p.label, value: p.value }))} />
          </div>
        </Figure>
      </section>

      <section className="admin-grid-2">
        <Figure title="Waiting on you" note="Nobody has touched these in two days." right={<Link href="/admin/leads" className="admin-btn">All leads</Link>}>
          {m.stale.length ? (
            <ul className="admin-list">
              {m.stale.map((l) => (
                <li key={l.id}>
                  <Link href={`/admin/leads/${l.id}`}>{l.name || l.email || 'Lead'}</Link>
                  <span className="meta"><StagePill id={l.stage} /> {ago(l.updatedAt)}</span>
                </li>
              ))}
            </ul>
          ) : <Empty>Nothing is going cold. Everything live has been touched in the last two days.</Empty>}
        </Figure>

        <Figure title="What has happened" note="Every change, newest first.">
          <Timeline items={recent} />
        </Figure>
      </section>

      {m.forms.length > 1 && (
        <Figure title="Which form they used" note="One colour: the bar's length is already the ranking.">
          <Ranked rows={m.forms} />
        </Figure>
      )}
    </div>
  );
}

function pickRange(raw: string | undefined): number {
  const n = Number(raw);
  return (RANGES as readonly number[]).includes(n) ? n : 30;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Still up.';
  if (h < 12) return 'Good morning.';
  if (h < 18) return 'Good afternoon.';
  return 'Good evening.';
}

/** A signed change against the previous window, with the direction that is good. */
function deltaOf(now: number, before: number, upIsGood: boolean): Partial<Stat> {
  const c = change(now, before);
  if (!c) return {};
  return { delta: `${c.delta} vs the ${before === 0 ? 'nothing' : 'period'} before`, good: c.up === upIsGood };
}

function tile(id: string, label: string, now: number, before: number, spark: number[], hint?: string): Stat {
  return { id, label, value: compact(now), ...deltaOf(now, before, true), spark, hint };
}
