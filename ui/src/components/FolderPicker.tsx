/**
 * "Choose the folder" — an actual button, not a path to type.
 *
 * Asking somebody to paste `C:\Users\them\code\the-restaurant` is asking them
 * to know something a graphical computer has not required anybody to know
 * since about 1994, and getting it wrong is silent: a typo reads as "that is
 * not a website I can read", which sounds like a verdict on their site.
 *
 * So: Import opens the operating system's own picker, which is the thing
 * everybody already recognises. When that cannot run — a locked-down policy,
 * no desktop session — the same answer is available by walking the disk inside
 * this window, folders that look like websites first. And the field stays a
 * field, because pasting a path is still the fastest way for the people who
 * have it on the clipboard.
 */

import { useCallback, useEffect, useState } from 'react';
import { api, type FolderEntry, type FolderListing } from '@/lib/api';
import { toast } from '@/lib/store';
import { Button, Input, Spinner, cx } from '@/components/ui';
import { Icon } from './icons';

export function FolderField({ value, onChange, onCommit, placeholder, autoFocus, label }: {
  value: string;
  onChange: (v: string) => void;
  /** Pressing Enter, or choosing from either picker. */
  onCommit?: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  label?: string;
}) {
  const [browsing, setBrowsing] = useState(false);
  const [picking, setPicking] = useState(false);

  const take = (p: string) => { onChange(p); onCommit?.(p); };

  const importIt = async () => {
    setPicking(true);
    try {
      const r = await api.pickFolder(value.trim() || undefined);
      if (r.ok && r.path) { take(r.path); return; }
      // Cancelling is an answer, not a failure — say nothing. Anything else
      // means the native dialog is not available here, so open ours instead.
      if (r.reason && r.reason !== 'cancelled') { toast(r.reason, 'error'); setBrowsing(true); }
    } catch (e) { toast((e as Error).message, 'error'); setBrowsing(true); }
    finally { setPicking(false); }
  };

  return (
    <div>
      {label && <span className="legend block mb-1.5">{label}</span>}
      <div className="flex gap-2">
        <Input
          placeholder={placeholder ?? 'C:\\Users\\you\\code\\the-restaurant'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') onCommit?.(value); }}
          autoFocus={autoFocus}
          spellCheck={false}
          className="font-[family-name:var(--font-mono)] !text-[13px]"
        />
        <Button icon="folder" busy={picking} onClick={importIt} title="Choose it from your machine" className="shrink-0">Import</Button>
        <Button variant="quiet" icon="list" onClick={() => setBrowsing(true)} title="Browse from here" className="shrink-0" />
      </div>
      {browsing && <FolderBrowser start={value.trim() || undefined} onPick={(p) => { take(p); setBrowsing(false); }} onClose={() => setBrowsing(false)} />}
    </div>
  );
}

/** The fallback, and a perfectly good way in of its own. */
export function FolderBrowser({ start, onPick, onClose }: { start?: string; onPick: (path: string) => void; onClose: () => void }) {
  const [list, setList] = useState<FolderListing | null>(null);
  const [busy, setBusy] = useState(true);
  const [at, setAt] = useState(start);

  const load = useCallback(async (path?: string) => {
    setBusy(true);
    try {
      const r = await api.browseFolder(path);
      setList(r);
      setAt(r.path);
      if (!r.ok && r.reason) toast(r.reason, 'error');
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  }, []);

  useEffect(() => { void load(start); }, [load, start]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const row = (e: FolderEntry) => (
    <button
      key={e.path}
      onDoubleClick={() => onPick(e.path)}
      onClick={() => load(e.path)}
      title={e.path}
      className="w-full text-left px-3 py-2 rounded-lg flex items-center gap-2.5 text-[13px] text-bone-2 hover:bg-ink-3 hover:text-bone"
    >
      <Icon name="folder" size={14} className={cx('shrink-0', e.site ? 'text-volt' : 'text-bone-4')} />
      <span className="flex-1 truncate">{e.name}</span>
      {e.site && <span className="telemetry text-volt shrink-0">a website</span>}
    </button>
  );

  return (
    <div className="fixed inset-0 z-[110] grid place-items-center p-4 fade bg-ink/75 backdrop-blur-[3px]" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="panel w-[min(720px,100%)] h-[min(78vh,620px)] flex flex-col overflow-hidden shadow-2xl shadow-black/70">
        <header className="shrink-0 px-4 py-3 border-b border-line flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="d4">Choose a folder</div>
            <div className="telemetry text-bone-4 truncate mt-0.5">{at ?? '…'}</div>
          </div>
          <Button size="sm" variant="quiet" icon="x" onClick={onClose} />
        </header>

        <div className="flex-1 min-h-0 grid grid-cols-[190px_1fr]">
          <nav className="border-r border-line overflow-y-auto p-1.5">
            <div className="legend px-2 py-1.5">Places</div>
            {(list?.places ?? []).map((p) => (
              <button key={p.path} onClick={() => load(p.path)} className="w-full text-left px-2.5 py-1.5 rounded-md text-[13px] text-bone-2 hover:bg-ink-3 hover:text-bone truncate" title={p.path}>
                {p.name}
              </button>
            ))}
          </nav>

          <div className="min-h-0 overflow-y-auto p-1.5">
            {list?.up && (
              <button onClick={() => load(list.up)} className="w-full text-left px-3 py-2 rounded-lg flex items-center gap-2.5 text-[13px] text-bone-3 hover:bg-ink-3 hover:text-bone">
                <Icon name="arrowLeft" size={14} className="shrink-0" /> up one
              </button>
            )}
            {busy && <div className="p-6 flex items-center gap-3 text-bone-3"><Spinner /> reading…</div>}
            {!busy && list?.entries.length === 0 && <div className="p-6 text-[13px] text-bone-3">Nothing inside this one. It can still be the answer — press Choose.</div>}
            {!busy && list?.entries.map(row)}
            {list?.truncated && <div className="px-3 py-2 telemetry text-bone-4">…and more. Type the path if what you want is not listed.</div>}
          </div>
        </div>

        <footer className="shrink-0 px-4 py-3 border-t border-line flex items-center justify-between gap-3">
          <span className="telemetry text-bone-4 hidden sm:inline">click to open · double-click to choose</span>
          <div className="flex items-center gap-2">
            <Button variant="quiet" onClick={onClose}>Cancel</Button>
            <Button variant="primary" icon="check" disabled={!at} onClick={() => at && onPick(at)}>Choose this folder</Button>
          </div>
        </footer>
      </div>
    </div>
  );
}
