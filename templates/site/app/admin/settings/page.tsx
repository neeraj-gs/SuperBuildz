import { repo } from '@/db/repo';
import { STAGES, FORMS } from '@/db/pipeline';
import { design } from '@/design.config';
import { dialect } from '@/db';
import { saveSetting } from '../actions';
import { currentAdmin } from '@/lib/auth';
import LoginPage from '../login/page';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  if (!(await currentAdmin())) return <LoginPage />;
  const notify = (await repo.setting('notify_email')) ?? '';
  return (
    <div className="grid gap-5 max-w-[820px]">
      <header><div className="admin-label">Settings</div><h1 className="font-display text-2xl mt-1">How this CRM is wired</h1></header>
      <section className="admin-card p-5 grid gap-3">
        <div className="admin-label">Pipeline stages</div>
        <div className="flex flex-wrap gap-2">{STAGES.map((s) => <span key={s.id} className="admin-pill">{s.label}{s.won ? ' · won' : s.lost ? ' · lost' : ''}</span>)}</div>
        <p className="text-sm opacity-70">Stages and which form lands where are defined in <code className="font-mono">db/pipeline.ts</code>. Ask in the Super Builds chat to rename or add stages.</p>
      </section>
      <section className="admin-card p-5 grid gap-3">
        <div className="admin-label">Forms → stages</div>
        <table className="admin-table"><tbody>{Object.entries(FORMS).map(([f, d]) => <tr key={f}><td className="font-mono">{f}</td><td>{STAGES.find((s) => s.id === d.stage)?.label}</td></tr>)}</tbody></table>
      </section>
      <form action={saveSetting.bind(null, 'notify_email')} className="admin-card p-5 grid gap-3">
        <div className="admin-label">Notify this email when a lead arrives</div>
        <div className="flex gap-2"><input name="value" type="email" defaultValue={notify} placeholder="you@example.com" className="admin-input flex-1" /><button className="admin-btn-primary" style={{ height: 40 }}>Save</button></div>
        <p className="text-sm opacity-70">Sending needs an email provider key (RESEND_API_KEY). Ask in the chat to wire it.</p>
      </form>
      <section className="admin-card p-5 text-sm grid gap-1">
        <div className="admin-label mb-2">About</div>
        <div>Site: <b>{design.name}</b> · Theme: {design.theme} · Scene: {design.scene.id}</div>
        <div>Database: <b>{dialect}</b>{dialect === 'sqlite' ? ' (data/site.db — set DATABASE_URL before deploying)' : ''}</div>
        <div>Analytics: {process.env.NEXT_PUBLIC_ANALYTICS ?? 'custom'}</div>
      </section>
    </div>
  );
}
