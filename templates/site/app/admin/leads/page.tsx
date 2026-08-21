import Link from 'next/link';
import { repo } from '@/db/repo';
import { STAGES } from '@/db/pipeline';
import { LeadsTable } from '../ui';
import { Kanban } from '../Kanban';
import { currentAdmin } from '@/lib/auth';
import LoginPage from '../login/page';

export const dynamic = 'force-dynamic';

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ view?: string; stage?: string; q?: string; archived?: string }> }) {
  if (!(await currentAdmin())) return <LoginPage />;
  const sp = await searchParams;
  const view = sp.view === 'table' ? 'table' : 'board';
  const leads = await repo.leads({ stage: sp.stage || undefined, search: sp.q || undefined, archived: sp.archived === '1' });
  return (
    <div className="grid gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div><div className="admin-label">Leads</div><h1 className="font-display text-2xl mt-1">{leads.length} {sp.stage ? STAGES.find((s) => s.id === sp.stage)?.label.toLowerCase() : 'open'}</h1></div>
        <form className="flex flex-wrap gap-2 items-center" action="/admin/leads">
          <input name="q" defaultValue={sp.q ?? ''} placeholder="Search name, email, message" className="admin-input" style={{ height: 34, width: 260 }} />
          <input type="hidden" name="view" value={view} />
          <button className="admin-btn">Search</button>
          <Link href={`/admin/leads?view=${view === 'board' ? 'table' : 'board'}`} className="admin-btn">{view === 'board' ? 'Table' : 'Board'}</Link>
          <Link href="/admin/leads?archived=1&view=table" className="admin-btn">Archived</Link>
          <a href="/api/admin/export" className="admin-btn">CSV</a>
        </form>
      </header>
      {view === 'board' ? <Kanban leads={leads} stages={STAGES} /> : <LeadsTable leads={leads} />}
    </div>
  );
}
