import Link from 'next/link';
import { notFound } from 'next/navigation';
import { repo } from '@/db/repo';
import { STAGES } from '@/db/pipeline';
import { StagePill, Timeline, ago } from '../../ui';
import { moveStage, addNote, logTouch, updateLead, archiveLead } from '../../actions';
import { currentAdmin } from '@/lib/auth';
import LoginPage from '../../login/page';

export const dynamic = 'force-dynamic';

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await currentAdmin())) return <LoginPage />;
  const { id } = await params;
  const lead = await repo.lead(id);
  if (!lead) notFound();
  const activity = await repo.activities(id);
  const fields = Object.entries(JSON.parse(lead.fields || '{}') as Record<string, string>);
  return (
    <div className="grid gap-5">
      <Link href="/admin/leads" className="text-sm opacity-70 hover:opacity-100">← Leads</Link>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl">{lead.name || lead.email || 'Lead'}</h1>
          <div className="text-sm opacity-70 mt-1">{lead.email}{lead.phone ? ` · ${lead.phone}` : ''}{lead.company ? ` · ${lead.company}` : ''} · via {lead.source} · {ago(lead.createdAt)}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StagePill id={lead.stage} />
          {STAGES.filter((s) => s.id !== lead.stage).map((s) => (
            <form key={s.id} action={moveStage.bind(null, id, s.id)}><button className="admin-btn">→ {s.label}</button></form>
          ))}
        </div>
      </header>
      <div className="grid lg:grid-cols-[1.3fr_1fr] gap-3">
        <div className="grid gap-3">
          {lead.message && <div className="admin-card p-5"><div className="admin-label mb-2">Message</div><p className="whitespace-pre-wrap">{lead.message}</p></div>}
          {fields.length > 0 && <div className="admin-card p-5"><div className="admin-label mb-3">Everything they sent</div><dl className="grid grid-cols-[160px_1fr] gap-y-2 text-sm">{fields.map(([k, v]) => <div key={k} className="contents"><dt className="opacity-60">{k}</dt><dd>{String(v)}</dd></div>)}</dl></div>}
          <div className="admin-card p-5">
            <div className="admin-label mb-3">Activity</div>
            <form action={addNote.bind(null, id)} className="flex gap-2 mb-4"><input name="text" placeholder="Add a note" className="admin-input flex-1" /><button className="admin-btn-primary" style={{ height: 40 }}>Add</button></form>
            <div className="flex gap-2 mb-4">
              <form action={logTouch.bind(null, id, 'email')}><button className="admin-btn">Log email</button></form>
              <form action={logTouch.bind(null, id, 'call')}><button className="admin-btn">Log call</button></form>
              {lead.email && <a className="admin-btn inline-flex items-center" href={`mailto:${lead.email}`}>Email them</a>}
              {lead.phone && <a className="admin-btn inline-flex items-center" href={`tel:${lead.phone}`}>Call them</a>}
            </div>
            <Timeline items={activity} />
          </div>
        </div>
        <div className="grid gap-3 content-start">
          <form action={updateLead.bind(null, id)} className="admin-card p-5 grid gap-3">
            <div className="admin-label">Details</div>
            {(['name', 'email', 'phone', 'company', 'tags'] as const).map((f) => <label key={f} className="admin-label">{f}<input name={f} defaultValue={lead[f]} className="admin-input" /></label>)}
            <label className="admin-label">Estimated value<input name="value" type="number" step="any" defaultValue={lead.value || ''} className="admin-input" /></label>
            <button className="admin-btn-primary">Save</button>
          </form>
          <form action={archiveLead.bind(null, id, !lead.archived)}><button className="admin-btn w-full">{lead.archived ? 'Restore' : 'Archive'}</button></form>
          <div className="text-xs opacity-60">Landed from {lead.page || 'the site'}.</div>
        </div>
      </div>
    </div>
  );
}
