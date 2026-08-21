'use client';

import { useRef, useState, type FormEvent } from 'react';
import { track } from '@/lib/analytics';

export interface FieldDef { name: string; label: string; type?: 'text' | 'email' | 'tel' | 'textarea' | 'select' | 'date' | 'number'; required?: boolean; options?: string[]; placeholder?: string }

/**
 * Every form on the site. Posts to /api/forms/[name], which validates,
 * rate-limits and writes a lead. A honeypot and a time-to-submit check keep
 * most bots out without a captcha. Tells the person it worked.
 */
export function Form({ name, fields, submitLabel = 'Send', success = 'Thank you. We will be in touch.', className = '' }: { name: string; fields: FieldDef[]; submitLabel?: string; success?: string; className?: string }) {
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');
  const started = useRef(Date.now());
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data: Record<string, string> = {};
    fd.forEach((v, k) => { data[k] = String(v); });
    setState('sending'); setError('');
    track(`form_start`, { form: name });
    try {
      const res = await fetch(`/api/forms/${name}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...data, _t: Date.now() - started.current, _page: location.pathname }) });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error ?? 'Something went wrong. Please try again.');
      setState('done');
      track('form_submit', { form: name });
    } catch (err) { setState('error'); setError((err as Error).message); }
  };
  if (state === 'done') return <div role="status" className={`rounded-[var(--radius-lg)] border hairline bg-surface p-6 ${className}`}><p className="display-sm text-xl">{success}</p></div>;
  return (
    <form onSubmit={submit} className={`grid gap-4 ${className}`} noValidate>
      {fields.map((f) => (
        <label key={f.name} className="grid gap-1.5">
          <span className="eyebrow">{f.label}{f.required && <span className="text-accent"> *</span>}</span>
          {f.type === 'textarea' ? (
            <textarea name={f.name} required={f.required} placeholder={f.placeholder} rows={4} className="w-full rounded-[var(--radius)] border hairline bg-surface px-4 py-3 outline-none focus:border-accent transition-colors" />
          ) : f.type === 'select' ? (
            <select name={f.name} required={f.required} className="h-12 rounded-[var(--radius)] border hairline bg-surface px-4 outline-none focus:border-accent">
              <option value="">Choose…</option>{(f.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          ) : (
            <input name={f.name} type={f.type ?? 'text'} required={f.required} placeholder={f.placeholder} className="h-12 rounded-[var(--radius)] border hairline bg-surface px-4 outline-none focus:border-accent transition-colors" />
          )}
        </label>
      ))}
      {/* Honeypot: real people never see it. */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute opacity-0 h-0 w-0 pointer-events-none" />
      <div className="flex items-center gap-4 mt-2">
        <button type="submit" disabled={state === 'sending'} className="h-12 px-6 rounded-full bg-accent text-bg font-medium disabled:opacity-60">{state === 'sending' ? 'Sending…' : submitLabel}</button>
        {state === 'error' && <span role="alert" className="text-sm opacity-90">{error}</span>}
      </div>
    </form>
  );
}
