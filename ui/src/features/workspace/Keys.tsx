/**
 * "It needs a key." Asked for, in a field, with the value going nowhere.
 *
 * ── Why this is a form and not a sentence ───────────────────────────────────
 *
 * A key is the one thing in this product that genuinely cannot be chosen from
 * a list. Everything else is a press; this has to be typed, once. Until now
 * the tool's whole answer to it was to name the variable — in the preview
 * panel, and again in a paragraph half way up a transcript — and then point at
 * a file editor. Which is to say it knew what was wrong, knew what would fix
 * it, and sent somebody who does not write code to edit a dotfile.
 *
 * ── What the person is owed before they paste a secret ──────────────────────
 *
 * Whose key it is, what it is for, the page it is copied from, whether it will
 * be visible in the browser, and where the value ends up. All five are on the
 * card. The last one is not decoration: somebody about to paste a live Stripe
 * key into a window is entitled to know it is going into a file on their own
 * disk and not into a conversation, and to be told before they paste rather
 * than after.
 *
 * ── Why secrets are masked and public keys are not ──────────────────────────
 *
 * Because the difference is real and worth teaching. A `NEXT_PUBLIC_` value is
 * compiled into the page and served to every visitor — masking it would imply
 * a secrecy it does not have. Everything else is dotted out, with a reveal, so
 * a mistyped key can still be checked.
 */

import { useEffect, useRef, useState } from 'react';
import type { KeyRequest } from '@superbuilds/protocol';
import { api } from '@/lib/api';
import { useStore, toast } from '@/lib/store';
import { Button, Input, Spinner, cx } from '@/components/ui';
import { Icon } from '@/components/icons';

export function KeysDialog({ projectId, only, onClose }: { projectId: string; only?: string[]; onClose: () => void }) {
  const state = useStore((s) => s.keys[projectId]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void api.keys(projectId).then((k) => useStore.setState((s) => ({ keys: { ...s.keys, [projectId]: k } }))).catch(() => {});
  }, [projectId]);

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => panel.current?.querySelector('input')?.focus(), 40);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', onKey, true);
    return () => { clearTimeout(t); window.removeEventListener('keydown', onKey, true); before?.focus?.(); };
  }, [onClose]);

  // `only` is set when a notice named particular variables: answer that
  // question rather than every question the project has.
  const all = state?.needed ?? [];
  const asked = only?.length ? all.filter((k) => only.includes(k.name)) : all;
  const missing = only?.length ? only.filter((n) => !all.some((k) => k.name === n)) : [];

  const anything = Object.values(values).some((v) => v.trim());

  const save = async () => {
    if (!anything) return;
    setSaving(true);
    try {
      const r = await api.fillKeys(projectId, values);
      // Never the value, and never even the length of it. The names are the
      // only part of this it is safe to say out loud.
      toast(
        r.restarting
          ? `${r.written.join(', ')} saved. Restarting the site so it picks it up…`
          : `${r.written.join(', ')} saved into this site's .env.local.`,
        'ok',
      );
      setValues({});
      onClose();
    } catch (e) { toast((e as Error).message, 'error'); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[115] grid place-items-center p-4 fade bg-ink/70 backdrop-blur-[3px]" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} role="dialog" aria-modal="true" aria-label="Keys this site needs">
      <div ref={panel} className="panel noise relative w-[min(540px,100%)] max-h-[min(88svh,780px)] flex flex-col shadow-2xl shadow-black/70 rise">
        <div className="p-6 pb-4 shrink-0">
          <button onClick={onClose} aria-label="Close" className="absolute top-4 right-4 text-bone-4 hover:text-bone"><Icon name="x" size={14} /></button>
          <h3 className="legend">This site</h3>
          <p className="d3 mt-2">{asked.length === 1 ? 'It needs a key' : 'It needs a few keys'}</p>
          <p className="text-[13px] leading-relaxed text-bone-3 mt-3">
            Paste each one below. It goes straight into this site&rsquo;s <code className="telemetry text-volt">.env.local</code> on
            your machine, which is git-ignored — not into the conversation, not to me, and nowhere
            else.
          </p>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 space-y-3">
          {!state && <div className="py-6 grid place-items-center"><Spinner /></div>}
          {state && asked.length === 0 && missing.length === 0 && (
            <p className="text-[13.5px] text-bone-2 py-4">Nothing is waiting for a key. Everything this site asks for has a value.</p>
          )}
          {asked.map((k) => (
            <Field key={k.name} field={k} value={values[k.name] ?? ''} onChange={(v) => setValues((s) => ({ ...s, [k.name]: v }))} onEnter={save} />
          ))}
          {missing.map((name) => (
            <p key={name} className="text-[12.5px] text-bone-4">
              <code className="telemetry">{name}</code> already has a value.
            </p>
          ))}
        </div>

        <div className="p-6 pt-4 shrink-0 border-t border-line flex items-center justify-between gap-4">
          {/* Hidden on a narrow one: it wraps to five lines there and crowds
              the two controls that matter into a corner. */}
          <p className="hidden sm:block text-[11.5px] leading-snug text-bone-4 max-w-[30ch]">
            The site restarts afterwards, because a dev server reads its keys once when it starts.
          </p>
          <div className="flex items-center gap-2">
            <Button variant="quiet" onClick={onClose}>Not now</Button>
            <Button variant="primary" icon="check" busy={saving} disabled={!anything} onClick={save}>Save</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ field, value, onChange, onEnter }: { field: KeyRequest; value: string; onChange: (v: string) => void; onEnter: () => void }) {
  const [shown, setShown] = useState(false);
  const masked = field.secret && !shown;

  return (
    <div className={cx('rounded-xl border p-3.5', field.urgent ? 'border-warn/40 bg-warn/[0.06]' : 'border-line bg-ink-2/60')}>
      {field.urgent && field.why && (
        <p className="text-[12.5px] text-warn/90 flex items-start gap-1.5 mb-2">
          <Icon name="alert" size={13} className="shrink-0 mt-0.5" />{field.why}
        </p>
      )}
      <p className="text-[13.5px] leading-snug text-bone">{field.what}</p>

      <label className="block mt-3">
        <span className="legend flex items-center gap-2">
          {field.label}
          <span className={cx('normal-case tracking-normal text-[10.5px] px-1.5 py-px rounded-full border', field.secret ? 'border-line-2 text-bone-4' : 'border-volt-3 text-volt')}>
            {field.secret ? 'server only' : 'shown in the browser'}
          </span>
        </span>
        <div className="flex items-center gap-1.5 mt-1.5">
          <Input
            type={masked ? 'password' : 'text'}
            value={value}
            placeholder={field.placeholder ?? 'paste it here'}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onEnter(); } }}
            className="flex-1 font-[family-name:var(--font-mono)] text-[12.5px]"
          />
          {field.secret && (
            <button type="button" onClick={() => setShown((s) => !s)} title={shown ? 'Hide it' : 'Show it'} className="shrink-0 text-bone-4 hover:text-bone px-1">
              <Icon name="eye" size={14} />
            </button>
          )}
        </div>
      </label>

      {field.keysUrl && (
        <a href={field.keysUrl} target="_blank" rel="noreferrer noopener" className="telemetry text-volt hover:underline inline-flex items-center gap-1 mt-2">
          where to find it <Icon name="external" size={11} />
        </a>
      )}
    </div>
  );
}

/**
 * The persistent way of knowing, for somebody who is not looking at the chat.
 *
 * It lives in the project header, beside the name, because the whole premise
 * of this feature is that people do not read transcripts — so the count has to
 * be somewhere it is true from every tab of the workspace, including the ones
 * that are not the conversation.
 */
export function KeysBadge({ projectId, onOpen }: { projectId: string; onOpen: () => void }) {
  const state = useStore((s) => s.keys[projectId]);
  const needed = state?.needed ?? [];
  if (!needed.length) return null;
  const urgent = needed.some((k) => k.urgent);

  return (
    <button
      onClick={onOpen}
      title={needed.map((k) => k.name).join(', ')}
      className={cx(
        'shrink-0 inline-flex items-center gap-1.5 h-6 px-2 rounded-full border text-[11.5px] transition-colors',
        urgent ? 'border-warn/50 bg-warn/10 text-warn hover:bg-warn/15' : 'border-line-2 text-bone-3 hover:text-bone',
      )}
    >
      <Icon name="key" size={11} />
      {needed.length === 1 ? '1 key needed' : `${needed.length} keys needed`}
    </button>
  );
}
