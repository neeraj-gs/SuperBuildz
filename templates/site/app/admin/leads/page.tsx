import Link from 'next/link';
import { repo } from '@/db/repo';
import { STAGES, stageFor } from '@/db/pipeline';
import { design } from '@/design.config';
import { LeadsTable, money } from '../ui';
import { Kanban } from '../Kanban';
import { Ranked, StatTile, compact, type Stat } from '../charts';
import { currentAdmin } from '@/lib/auth';
import LoginPage from '../login/page';

export const dynamic = 'force-dynamic';

/**
 * Everybody who has ever asked for something.
 *
 * ── One filter row, above everything it scopes ──────────────────────────────
 *
 * Search, stage and archived are one row at the top, and both views — the board
 * and the table — render against the same slice. Per-panel filters are how a
 * dashboard ends up showing two different answers to the same question at the
 * same time.
 */
export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ view?: string; stage?: string; q?: string; archived?: string }> }) {
  if (!(await currentAdmin())) return <LoginPage />;

  const sp = await searchParams;
  const view = sp.view === 'table' ? 'table' : 'board';
  const archived = sp.archived === '1';
  const [leads, all] = await Promise.all([
    repo.leads({ stage: sp.stage || undefined, search: sp.q || undefined, archived }),
    repo.leads({ archived: false, limit: 2000 }),
  ]);

  const open = all.filter((l) => !stageFor(l.stage).won && !stageFor(l.stage).lost);
  const won = all.filter((l) => stageFor(l.stage).won);
  const byStage = STAGES.map((s) => ({ label: s.label, value: all.filter((l) => l.stage === s.id).length })).filter((s) => s.value);

  const stats: Stat[] = [
    { id: 'open', label: 'Live', value: compact(open.length), hint: 'Not yet won or lost' },
    { id: 'value', label: 'Open pipeline', value: money(open.reduce((n, l) => n + l.value, 0), design.locale, design.currency) },
    { id: 'won', label: 'Won', value: compact(won.length), hint: money(won.reduce((n, l) => n + l.value, 0), design.locale, design.currency) + ' all told' },
    { id: 'all', label: 'Everybody, ever', value: compact(all.length) },
  ];

  const heading = sp.q
    ? `${leads.length} matching “${sp.q}”`
    : archived
      ? `${leads.length} archived`
      : sp.stage
        ? `${leads.length} ${stageFor(sp.stage).label.toLowerCase()}`
        : `${leads.length} ${leads.length === 1 ? 'lead' : 'leads'}`;

  return (
    <div className="admin-page">
      <header className="admin-hero">
        <div className="admin-hero-body">
          <div>
            <div className="admin-eyebrow">Leads</div>
            <h1 className="admin-title">{heading}</h1>
            <p className="admin-lede">Drag a card between columns to move somebody along. Everything you change is recorded on their timeline.</p>
          </div>
          <form className="admin-range" action="/admin/leads">
            <input name="q" defaultValue={sp.q ?? ''} placeholder="Name, email, message" className="admin-input" style={{ height: 34, width: 220 }} aria-label="Search leads" />
            <input type="hidden" name="view" value={view} />
            {sp.stage && <input type="hidden" name="stage" value={sp.stage} />}
            <button className="admin-btn">Search</button>
            <Link href={`/admin/leads?view=${view === 'board' ? 'table' : 'board'}${sp.stage ? `&stage=${sp.stage}` : ''}`} className="admin-btn">
              {view === 'board' ? 'As a table' : 'As a board'}
            </Link>
            <Link href={archived ? '/admin/leads' : '/admin/leads?archived=1&view=table'} className={`admin-btn${archived ? ' is-on' : ''}`}>Archived</Link>
            <a href="/api/admin/export" className="admin-btn">Export CSV</a>
          </form>
        </div>
      </header>

      {!archived && (
        <section className="admin-grid-4" aria-label="Headline numbers">
          {stats.map((s) => <StatTile key={s.id} s={s} />)}
        </section>
      )}

      {/* Stage chips are the fast filter; the board is the slow one. */}
      <nav className="admin-range" aria-label="Filter by stage">
        <Link href={`/admin/leads?view=${view}`} className={`admin-btn${!sp.stage && !archived ? ' is-on' : ''}`}>Everyone</Link>
        {STAGES.map((s) => (
          <Link key={s.id} href={`/admin/leads?view=${view}&stage=${s.id}`} className={`admin-btn${sp.stage === s.id ? ' is-on' : ''}`}>
            {s.label}
            <span style={{ opacity: 0.5 }}>{all.filter((l) => l.stage === s.id).length}</span>
          </Link>
        ))}
      </nav>

      {view === 'board'
        ? <Kanban leads={leads} stages={STAGES} />
        : <LeadsTable leads={leads} locale={design.locale} currency={design.currency} />}

      {byStage.length > 1 && !archived && (
        <figure className="admin-card admin-figure">
          <figcaption><span className="admin-figure-title">Where everybody is</span></figcaption>
          <p className="admin-figure-note">Counting everyone who has ever come in, not just this month.</p>
          <Ranked rows={byStage} />
        </figure>
      )}
    </div>
  );
}
