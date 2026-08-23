/**
 * Requirements. Every row is a fact the daemon observed, with a button that
 * closes the gap — installs open a terminal the person can watch; sign-in is
 * Anthropic's own flow; "let Claude sort it out" hands the machine to a
 * session with the install prompt.
 */

import { useEffect, useState } from 'react';
import { useStore, navigate, toast } from '@/lib/store';
import { api } from '@/lib/api';
import { Button, Index, Spinner, cx } from '@/components/ui';
import { Icon } from '@/components/icons';
import { Chat } from '@/features/workspace/Chat';
import type { InstallRecipeView } from '@superbuilds/protocol';

export function Setup() {
  const detection = useStore((s) => s.detection);
  const [busy, setBusy] = useState(false);
  const [acting, setActing] = useState<string | null>(null);
  const [plan, setPlan] = useState<{ platform: string; recipes: InstallRecipeView[] } | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const recheck = async () => {
    setBusy(true);
    try { await useStore.getState().loadDetection(); } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  };
  useEffect(() => { if (!detection) void recheck(); void api.installPlan().then(setPlan).catch(() => {}); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fix = async (id: string, action?: 'auth' | 'install') => {
    setActing(id);
    try {
      const res = action === 'auth' ? await api.authLogin() : await api.install([id === 'version' ? 'claude' : id]);
      toast(res.message, res.ok ? 'ok' : 'error');
    } catch (e) { toast((e as Error).message, 'error'); } finally { setActing(null); }
  };

  const missing = detection?.checks.filter((c) => !c.ok && c.fixAction === 'install').map((c) => (c.id === 'version' ? 'claude' : c.id)) ?? [];
  const required = detection?.checks.filter((c) => !c.optional) ?? [];
  const optional = detection?.checks.filter((c) => c.optional) ?? [];

  const [machineSession, setMachineSession] = useState<string | null>(null);
  const sessions = useStore((s) => s.sessions);
  const letClaude = async () => {
    if (!missing.length) return;
    try {
      const r = await api.provision([...new Set(missing)]);
      setMachineSession(r.sessionId);
      await useStore.getState().loadSession(r.sessionId);
      toast(r.busy ? 'Claude is already working on it.' : 'Claude Code is setting up this machine. Follow along below; press Check again when it reports done.', 'ok');
    } catch (e) { toast((e as Error).message, 'error'); }
  };

  return (
    <div className="shell pt-12">
      <Index n={1} className="mb-8">Requirements</Index>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <h1 className="d2 max-w-[18ch]">What this machine needs, and <span className="serif">what it has.</span></h1>
        <div className="flex items-center gap-2">
          <Button icon="refresh" onClick={recheck} busy={busy}>Check again</Button>
          {detection?.ok && <Button variant="primary" iconRight="arrowRight" onClick={() => navigate({ name: 'new' })}>Build a site</Button>}
        </div>
      </div>
      <p className="copy mt-4">Super Builds runs your own Claude Code and publishes with your own Vercel login. It checks by asking each tool about itself; it never reads a credentials file.</p>

      {!detection && <div className="panel p-10 mt-8 flex items-center gap-3 text-bone-2"><Spinner /> Asking each tool about itself…</div>}

      {detection && (
        <>
          <Summary ok={detection.ok} account={detection.account} missing={missing.length} onClaude={letClaude} />
          <Group title="Needed to build" rows={required} acting={acting} fix={fix} plan={plan} open={open} setOpen={setOpen} />
          <Group title="Optional — unlocks more" rows={optional} acting={acting} fix={fix} plan={plan} open={open} setOpen={setOpen} />
          {machineSession && sessions[machineSession] && (
            <section className="mt-10">
              <Index className="mb-4">Claude, setting up this machine</Index>
              <div className="panel h-[460px] flex flex-col overflow-hidden"><Chat session={sessions[machineSession]} projectId="machine" busy={false} /></div>
            </section>
          )}
          <p className="telemetry text-bone-4 mt-10 pt-6 border-t border-line">Platform: {detection.platform} · Claude Code {detection.claudeVersion ?? '—'} at {detection.claudeBin}</p>
        </>
      )}
    </div>
  );
}

function Summary({ ok, account, missing, onClaude }: { ok: boolean; account?: { email?: string; plan?: string }; missing: number; onClaude: () => void }) {
  return (
    <div className={cx('panel mt-8 p-5 flex flex-wrap items-center justify-between gap-4', ok ? 'border-volt-3' : 'border-danger/40')}>
      <div className="flex items-center gap-4">
        <span className={cx('grid place-items-center w-10 h-10 rounded-full shrink-0', ok ? 'bg-volt text-[color:var(--color-volt-ink)]' : 'bg-danger/15 text-danger')}><Icon name={ok ? 'check' : 'alert'} size={18} /></span>
        <div>
          <div className="d4">{ok ? 'Ready to build.' : 'Something is missing.'}</div>
          <div className="text-bone-3 text-[13px] mt-0.5">{ok ? (account?.email ? `Signed in as ${account.email}${account.plan ? ` · ${account.plan}` : ''}` : 'Everything needed is here.') : 'Each row below says what and offers a button.'}</div>
        </div>
      </div>
      {!ok && missing > 0 && <Button icon="sparkle" onClick={onClaude}>Let Claude sort it out</Button>}
    </div>
  );
}

function Group({ title, rows, acting, fix, plan, open, setOpen }: { title: string; rows: import('@superbuilds/protocol').DetectionCheck[]; acting: string | null; fix: (id: string, a?: 'auth' | 'install') => void; plan: { platform: string; recipes: InstallRecipeView[] } | null; open: string | null; setOpen: (s: string | null) => void }) {
  if (!rows.length) return null;
  return (
    <section className="mt-10">
      <Index className="mb-4">{title}</Index>
      <div className="panel divide-y divide-line overflow-hidden">
        {rows.map((c) => {
          const recipe = plan?.recipes.find((r) => r.id === (c.id === 'version' ? 'claude' : c.id));
          const isOpen = open === c.id;
          return (
            <div key={c.id}>
              <div className="flex items-center gap-4 px-4 py-3.5">
                <span className={cx('w-1.5 h-1.5 rounded-full shrink-0', c.ok ? 'bg-volt' : c.optional ? 'bg-bone-4' : 'bg-danger')} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap"><span className="font-semibold text-[13.5px]">{c.label}</span>{c.optional && c.unlocks && <span className="telemetry text-bone-3">unlocks {c.unlocks.toLowerCase()}</span>}</div>
                  <div className="telemetry text-bone-3 truncate mt-0.5">{c.detail}</div>
                  <div className="text-[12.5px] text-bone-4 mt-1 measure">{c.why}</div>
                </div>
                {!c.ok && c.fixAction && <Button size="sm" variant={c.optional ? 'ghost' : 'primary'} busy={acting === c.id} onClick={() => fix(c.id, c.fixAction)}>{c.fixLabel ?? 'Do it for me'}</Button>}
                {!c.ok && c.fixUrl && !c.fixAction && <a className="btn btn-ghost btn-sm" href={c.fixUrl} target="_blank" rel="noreferrer">{c.fixLabel ?? 'How'} <Icon name="external" size={13} /></a>}
                {recipe && <button className="text-bone-3 hover:text-bone p-1" onClick={() => setOpen(isOpen ? null : c.id)} aria-label="details"><Icon name="chevronDown" size={16} className={cx('transition-transform', isOpen && 'rotate-180')} /></button>}
              </div>
              {isOpen && recipe && (
                <div className="px-5 pb-5 pt-1 bg-ink">
                  <p className="text-[13.5px] text-bone-2 mb-3">{recipe.why}</p>
                  <div className="grid md:grid-cols-3 gap-3">
                    {(['windows', 'mac', 'linux'] as const).map((p) => (
                      <div key={p} className={cx('rounded-lg border p-3', plan?.platform === p ? 'border-volt/50' : 'border-line')}>
                        <div className="legend mb-2">{p}{plan?.platform === p ? ' · this machine' : ''}</div>
                        {recipe.steps[p].map((s, i) => s.command ? <code key={i} className="block telemetry text-bone bg-ink-2 rounded px-2 py-1.5 mb-1.5 break-all">{s.command}</code> : <p key={i} className="text-[12.5px] text-bone-3 mb-1.5">{s.text}</p>)}
                      </div>
                    ))}
                  </div>
                  {recipe.docs && <a className="telemetry text-volt inline-flex items-center gap-1 mt-3" href={recipe.docs} target="_blank" rel="noreferrer">Vendor documentation <Icon name="external" size={12} /></a>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
