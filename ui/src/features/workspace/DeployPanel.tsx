/**
 * Publish. The Vercel CLI does everything; this is the sheet that says what
 * is missing (the CLI, a sign-in, a database URL for the CRM), collects the
 * one thing it needs, and shows the log and the URL.
 */

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useStore, toast } from '@/lib/store';
import { Button, Input, Spinner, cx } from '@/components/ui';
import { Icon } from '@/components/icons';

export function DeployPanel({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const state = useStore((s) => s.deploys[projectId]);
  const project = useStore((s) => s.projects[projectId]);
  const [checking, setChecking] = useState(false);
  const [dbUrl, setDbUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const refresh = async () => { setChecking(true); try { const s = await api.deployStatus(projectId); useStore.getState().apply({ type: 'deploy.update', state: s }); } catch (e) { toast((e as Error).message, 'error'); } finally { setChecking(false); } };
  useEffect(() => { void refresh(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const needsDb = project?.spec?.crm === 'custom' && !state?.envKeys.includes('DATABASE_URL');
  const saveDb = async () => { if (!dbUrl.trim()) return; setSaving(true); try { await api.setEnv(projectId, 'DATABASE_URL', dbUrl.trim()); setDbUrl(''); toast('Saved into the site\'s .env.local.', 'ok'); await refresh(); } catch (e) { toast((e as Error).message, 'error'); } finally { setSaving(false); } };
  const publish = async () => { try { await api.deploy(projectId, 'production'); } catch (e) { toast((e as Error).message, 'error'); } };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-ink/60 backdrop-blur-sm" />
      <aside className="relative w-full max-w-[520px] h-full bg-ink-2 border-l border-line overflow-y-auto p-6 rise" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6"><div><p className="legend mb-1">Publish</p><h2 className="display-sm text-[24px]">Put it on Vercel.</h2></div><button onClick={onClose} className="text-bone-3 hover:text-bone"><Icon name="x" size={18} /></button></div>
        <p className="text-[13.5px] text-bone-2 mb-6">Everything runs the Vercel CLI in your project folder. You sign in through your own browser; Super Builds never sees the token. The first publish creates the project; later ones update it.</p>

        {!state ? <div className="flex items-center gap-2 text-bone-3"><Spinner /> Checking…</div> : (
          <div className="space-y-3">
            <Row ok={state.cli} label="Vercel CLI" detail={state.cli ? 'installed' : 'not installed'} action={!state.cli && <Button size="sm" onClick={() => api.install(['vercel']).then((r) => toast(r.message, r.ok ? 'ok' : 'error'))}>Install</Button>} />
            <Row ok={state.connected} label="Signed in to Vercel" detail={state.connected ? (state.account ?? 'yes') : 'not yet'} action={!state.connected && state.cli && <Button size="sm" onClick={() => api.deployLogin(projectId).then((r) => toast(r.message, r.ok ? 'ok' : 'error'))}>Connect Vercel</Button>} />
            <Row ok={!needsDb} label="Database for the CRM" detail={needsDb ? 'needs a Postgres URL' : state.envKeys.includes('DATABASE_URL') ? 'DATABASE_URL is set' : 'not needed'} />
            {needsDb && (
              <div className="panel p-4">
                <div className="text-[13.5px] mb-2">SQLite cannot live on Vercel, so the CRM needs a Postgres URL there. A free one takes two minutes: <a className="text-volt underline" href="https://neon.tech" target="_blank" rel="noreferrer">Neon</a> (also in the Vercel Marketplace) or <a className="text-volt underline" href="https://supabase.com" target="_blank" rel="noreferrer">Supabase</a>. Paste the connection string; it goes into the site's <code className="telemetry">.env.local</code> and is pushed to Vercel at publish.</div>
                <div className="flex gap-2"><Input placeholder="postgres://…" value={dbUrl} onChange={(e) => setDbUrl(e.target.value)} type="password" /><Button size="sm" variant="primary" busy={saving} onClick={saveDb}>Save</Button></div>
              </div>
            )}
            <div className="panel p-4">
              <div className="legend mb-2">Environment pushed at publish</div>
              <div className="flex flex-wrap gap-1.5">{state.envKeys.length ? state.envKeys.map((k) => <span key={k} className="telemetry border border-line rounded-full px-2 py-0.5">{k}</span>) : <span className="telemetry text-bone-3">none yet</span>}</div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Button variant="primary" size="lg" icon="rocket" busy={state.running} onClick={publish} disabled={!state.cli || !state.connected || needsDb}>Publish to production</Button>
              <Button variant="quiet" icon="refresh" busy={checking} onClick={refresh}>Check again</Button>
            </div>
            {state.url && <a href={state.url} target="_blank" rel="noreferrer" className="block panel p-4 border-volt/50 hover:bg-volt-2"><div className="legend mb-1">Live</div><div className="text-volt font-semibold inline-flex items-center gap-2">{state.url} <Icon name="external" size={14} /></div></a>}
            {state.error && <div className="text-danger text-[13px]">{state.error}</div>}
            {(state.running || state.log) && <pre className="telemetry text-bone-3 bg-ink-3 rounded-lg p-3 max-h-64 overflow-auto whitespace-pre-wrap">{state.log.slice(-6000) || 'starting…'}</pre>}
          </div>
        )}
      </aside>
    </div>
  );
}

function Row({ ok, label, detail, action }: { ok: boolean; label: string; detail: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 panel px-4 py-3">
      <span className={cx('w-2.5 h-2.5 rounded-full shrink-0', ok ? 'bg-volt' : 'bg-danger')} />
      <div className="flex-1"><div className="font-semibold text-[14px]">{label}</div><div className="telemetry text-bone-3">{detail}</div></div>
      {action}
    </div>
  );
}
