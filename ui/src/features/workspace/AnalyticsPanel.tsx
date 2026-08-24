/**
 * Where the numbers go.
 *
 * One card per destination: switch it on, paste whatever it needs, and follow
 * the link to the place the numbers actually live. That last line is the honest
 * part of this screen — only the built-in provider reports into a dashboard
 * Super Builds can show you, and pretending otherwise would mean shipping
 * eleven vendors' read APIs. So a card for PostHog says "your numbers are over
 * here" and takes you there in one press, which is what a person wanted anyway.
 *
 * Keys are written straight into the site's own `.env.local`. They pass through
 * this daemon and are never stored by Super Builds, and the deploy pushes them
 * to the host as environment variables rather than baking them into a build.
 */

import { useEffect, useMemo, useState } from 'react';
import type { AnalyticsProviderInfo, AnalyticsState } from '@superbuilds/protocol';
import { api } from '@/lib/api';
import { useStore, toast } from '@/lib/store';
import { Button, Input, Spinner, cx } from '@/components/ui';
import { Icon } from '@/components/icons';

export function AnalyticsPanel({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const pushed = useStore((s) => s.analytics[projectId]);
  const [state, setState] = useState<AnalyticsState | null>(pushed ?? null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.analytics(projectId).then(setState).catch((e) => toast(e.message, 'error')); }, [projectId]);
  useEffect(() => { if (pushed) setState(pushed); }, [pushed]);

  // Escape closes it. An overlay with only a backdrop to press is a trap for
  // anybody working from the keyboard.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);


  const toggle = async (id: string) => {
    if (!state) return;
    const next = state.enabled.includes(id) ? state.enabled.filter((x) => x !== id) : [...state.enabled, id];
    setBusy(true);
    try { setState(await api.setAnalytics(projectId, next)); }
    catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-ink/85 backdrop-blur-sm grid place-items-center p-4 fade" onClick={onClose}>
      <div className="panel w-[min(880px,100%)] max-h-[88vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-line">
          <div>
            <h2 className="d4">Analytics</h2>
            <p className="text-[13px] text-bone-3 mt-1 measure">
              Choose as many as you like. Every one is handed the same events, so a funnel means
              the same thing wherever you read it.
            </p>
          </div>
          <Button size="sm" variant="quiet" icon="x" onClick={onClose} />
        </header>

        {!state ? (
          <div className="p-10 grid place-items-center"><Spinner /></div>
        ) : (
          <div className="flex-1 min-h-0 overflow-auto p-4 grid gap-2.5">
            {state.providers.map((p) => (
              <ProviderCard
                key={p.id}
                p={p}
                on={state.enabled.includes(p.id)}
                filled={state.filled[p.id] ?? []}
                host={state.host}
                busy={busy}
                onToggle={() => void toggle(p.id)}
                onSave={async (values) => { setState(await api.setAnalyticsKeys(projectId, values)); }}
              />
            ))}
          </div>
        )}

        <footer className="px-6 py-3 border-t border-line flex items-center justify-between gap-3">
          <span className="telemetry text-bone-4">Written into the site's .env.local · restart the preview for a change to take</span>
          <Button size="sm" onClick={onClose}>Done</Button>
        </footer>
      </div>
    </div>
  );
}

function ProviderCard({ p, on, filled, host, busy, onToggle, onSave }: {
  p: AnalyticsProviderInfo; on: boolean; filled: string[]; host?: string; busy: boolean;
  onToggle: () => void; onSave: (values: Record<string, string>) => Promise<void>;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const required = p.fields.filter((f) => !f.optional);
  const ready = required.every((f) => filled.includes(f.key));
  const dashboard = useMemo(() => {
    if (!p.dashboard) return undefined;
    if (!p.dashboard.includes('{host}')) return p.dashboard;
    return host ? p.dashboard.replace('{host}', host) : p.dashboard.replace(/\/?\{host\}.*$/, '/');
  }, [p.dashboard, host]);

  const save = async () => {
    const dirty = Object.fromEntries(Object.entries(values).filter(([, v]) => v.trim()));
    if (!Object.keys(dirty).length) return;
    setSaving(true);
    try { await onSave(dirty); setValues({}); toast(`${p.label} is connected.`, 'ok'); }
    catch (e) { toast((e as Error).message, 'error'); } finally { setSaving(false); }
  };

  return (
    <div className={cx('rounded-xl border p-4 transition-colors', on ? 'border-volt-3 bg-volt-2' : 'border-line bg-ink-2')}>
      <div className="flex items-start gap-3">
        <button
          onClick={onToggle}
          disabled={busy}
          aria-pressed={on}
          className={cx('mt-0.5 shrink-0 w-10 h-6 rounded-full relative transition-colors', on ? 'bg-volt' : 'bg-ink-4 border border-line-2')}
          title={on ? `Turn ${p.label} off` : `Turn ${p.label} on`}
        >
          <span className={cx('absolute top-1 w-4 h-4 rounded-full transition-all', on ? 'left-5 bg-[color:var(--color-volt-ink)]' : 'left-1 bg-bone-3')} />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            {p.icon && <Icon name={p.icon} size={14} className={on ? 'text-volt' : 'text-bone-3'} />}
            <span className="font-semibold text-[14.5px]">{p.label}</span>
            {p.builtin && <span className="telemetry text-volt">shown inside /admin</span>}
            {on && !p.builtin && (ready
              ? <span className="telemetry text-volt">connected</span>
              : required.length > 0 && <span className="telemetry text-warn">needs a key</span>)}
          </div>
          <p className="text-[13px] text-bone-2 mt-1 leading-snug">{p.blurb}</p>
          {p.caveat && <p className="text-[12px] text-bone-4 mt-1">{p.caveat}</p>}

          {on && p.fields.length > 0 && (
            <div className="mt-3 grid gap-2.5">
              {p.fields.map((f) => (
                <label key={f.key} className="block">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="legend">{f.label}{f.optional && <span className="text-bone-4 normal-case tracking-normal"> — optional</span>}</span>
                    {filled.includes(f.key) && <span className="telemetry text-volt">saved</span>}
                  </span>
                  <Input
                    className="!h-8 mt-1"
                    type="text"
                    placeholder={filled.includes(f.key) ? '•••••••• — type to replace' : f.placeholder ?? f.key}
                    value={values[f.key] ?? ''}
                    onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === 'Enter') void save(); }}
                  />
                  {f.hint && <span className="block telemetry text-bone-4 mt-1">{f.hint}</span>}
                </label>
              ))}
              <div className="flex items-center gap-2">
                <Button size="sm" variant="primary" busy={saving} disabled={!Object.values(values).some((v) => v.trim())} onClick={save}>Save keys</Button>
                {p.keysUrl && <a className="btn btn-quiet btn-sm" href={p.keysUrl} target="_blank" rel="noreferrer"><Icon name="external" size={13} /> Where to find them</a>}
              </div>
            </div>
          )}

          {on && dashboard && !p.builtin && (
            <a className="btn btn-ghost btn-sm mt-3" href={dashboard} target="_blank" rel="noreferrer">
              <Icon name="chart" size={13} /> Read your numbers on {p.label}
              <Icon name="external" size={12} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
