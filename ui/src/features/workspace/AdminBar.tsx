/**
 * The CRM login, above the CRM.
 *
 * It appears on the /admin tab and nowhere else, because that is the one
 * moment the answer is useful. Everything about it is deliberately unglamorous
 * — two fields, two copy buttons, one way to change the password — because the
 * feature it replaces was a sentence telling somebody to open a text editor.
 *
 * The password is masked until asked for. Not because anyone else is likely to
 * be looking at this screen, but because a screen share is exactly when
 * somebody presses the CRM tab to show off the dashboard.
 */

import { useEffect, useState } from 'react';
import type { AdminLogin } from '@superbuilds/protocol';
import { api } from '@/lib/api';
import { toast } from '@/lib/store';
import { Button, Input, cx } from '@/components/ui';
import { Icon } from '@/components/icons';

export function AdminBar({ projectId, url }: { projectId: string; url?: string }) {
  const [login, setLogin] = useState<AdminLogin | null>(null);
  const [show, setShow] = useState(false);
  const [open, setOpen] = useState(true);
  const [changing, setChanging] = useState(false);
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.adminLogin(projectId).then(setLogin).catch(() => setLogin(null)); }, [projectId]);

  if (!login) return null;

  const copy = async (what: string, value: string) => {
    try { await navigator.clipboard.writeText(value); toast(`${what} copied.`, 'ok'); }
    catch { toast('The browser would not let me use the clipboard.', 'error'); }
  };

  const setPassword = async (password?: string) => {
    setBusy(true);
    try {
      const r = await api.setAdminPassword(projectId, password);
      setLogin((l) => (l ? { ...l, password: r.password, configured: true } : l));
      setShow(true); setChanging(false); setNext('');
      toast('New password set. Sign in again — the old session still works until it expires.', 'ok');
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  };

  const forget = async () => {
    if (!confirm('Forget the password? The CRM keeps working, but Super Builds will not be able to remind you what it is — only set you a new one.')) return;
    try { setLogin(await api.forgetAdminPassword(projectId)); setShow(false); toast('Forgotten. The hash is still there, so your login still works.', 'ok'); }
    catch (e) { toast((e as Error).message, 'error'); }
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="shrink-0 w-full px-3 py-1.5 text-left telemetry text-bone-3 hover:text-bone border-b border-line flex items-center gap-2">
        <Icon name="key" size={11} className="text-volt" /> show the CRM login
      </button>
    );
  }

  return (
    <div className="shrink-0 border-b border-line bg-ink-2/60 px-3 py-2.5">
      <div className="flex items-center gap-2 flex-wrap">
        <Icon name="key" size={13} className="text-volt shrink-0" />
        <span className="legend shrink-0">Your CRM login</span>

        <Field label="email" value={login.email || 'not set'} onCopy={() => copy('Email', login.email)} />

        {login.password ? (
          <Field
            label="password"
            value={show ? login.password : '•'.repeat(Math.min(14, login.password.length))}
            mono
            onCopy={() => copy('Password', login.password!)}
            extra={<button onClick={() => setShow((v) => !v)} className="telemetry text-bone-3 hover:text-bone px-1">{show ? 'hide' : 'show'}</button>}
          />
        ) : (
          <span className="telemetry text-bone-3">
            {login.configured ? 'set, but not kept on this machine' : 'not set yet'}
          </span>
        )}

        <span className="flex-1" />

        {url && <a className="btn btn-quiet btn-sm" href={`${url}/admin`} target="_blank" rel="noreferrer"><Icon name="external" size={13} /> Open /admin</a>}
        <Button size="sm" variant="quiet" icon="edit" onClick={() => setChanging((c) => !c)}>New password</Button>
        {login.password && <Button size="sm" variant="quiet" onClick={forget} title="Keep the login, drop the reminder">Forget it</Button>}
        <button onClick={() => setOpen(false)} className="text-bone-4 hover:text-bone px-1" title="Hide"><Icon name="x" size={13} /></button>
      </div>

      {changing && (
        <div className="flex items-center gap-2 mt-2.5 flex-wrap">
          <Input
            className="!h-8 max-w-[280px]"
            placeholder="Type one, or leave it blank for a good one"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void setPassword(next.trim() || undefined); }}
          />
          <Button size="sm" variant="primary" busy={busy} onClick={() => void setPassword(next.trim() || undefined)}>Set it</Button>
          <span className="text-[12.5px] text-bone-3">Written straight into the site's own .env.local. Restart the preview for it to take.</span>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onCopy, mono, extra }: { label: string; value: string; onCopy: () => void; mono?: boolean; extra?: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-ink pl-2.5 pr-1 py-1 min-w-0">
      <span className="telemetry text-bone-4 shrink-0">{label}</span>
      <span className={cx('text-[12.5px] truncate max-w-[240px]', mono && 'font-[family-name:var(--font-mono)]')}>{value}</span>
      {extra}
      <button onClick={onCopy} className="text-bone-3 hover:text-bone px-1 shrink-0" title="Copy"><Icon name="copy" size={12} /></button>
    </span>
  );
}
