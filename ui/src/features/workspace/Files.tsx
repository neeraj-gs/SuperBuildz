/**
 * The project's files, in the tool.
 *
 * A tree on the left, tabs and an editor on the right — the shape everybody
 * already knows, so nobody has to learn it. It exists because the chat is not
 * allowed to read `.env.local` and the person who needs an API key in it should
 * not be sent to Notepad.
 *
 * ── The editor is a textarea with a picture behind it ───────────────────────
 *
 * The highlighted code is a `<pre>` in normal flow, which is what decides the
 * width and height of everything; the textarea sits exactly on top of it,
 * transparent, with a visible caret. That is the whole trick, and it survives
 * long lines and wrapping only because both elements are given byte-identical
 * type: same family, size, line-height, letter-spacing, tab-size, padding,
 * white-space. Change one and you must change the other, which is why they are
 * both driven from `TYPE` below rather than from two class lists that look
 * similar.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FileBody, FileEntry } from '@superbuilds/protocol';
import { api } from '@/lib/api';
import { toast, ask } from '@/lib/store';
import { Button, Input, Spinner, cx } from '@/components/ui';
import { Icon } from '@/components/icons';
import { highlight, iconForFile } from './highlight';

/** The one place the editor's metrics live. Both layers read it. */
const TYPE: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: '12.5px',
  lineHeight: '1.6',
  letterSpacing: 0,
  tabSize: 2,
  whiteSpace: 'pre',
  padding: '14px 20px 40px 16px',
  margin: 0,
  border: 0,
};

interface Tab { path: string; body: FileBody; draft: string }

export function Files({ projectId, onClose, startAt }: { projectId: string; onClose: () => void; startAt?: string }) {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [active, setActive] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<Array<{ path: string; line?: number; text?: string }> | null>(null);

  const open = useCallback(async (path: string) => {
    setActive(path);
    setTabs((t) => (t.some((x) => x.path === path) ? t : t));
    try {
      const body = await api.file(projectId, path);
      setTabs((t) => (t.some((x) => x.path === path) ? t : [...t, { path, body, draft: body.text }].slice(-12)));
      setActive(path);
    } catch (e) { toast((e as Error).message, 'error'); }
  }, [projectId]);

  useEffect(() => { if (startAt) void open(startAt); }, [startAt, open]);

  // Search runs on the daemon: names first, then the first matching line.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setHits(null); return; }
    const t = setTimeout(() => { api.searchFiles(projectId, q).then((r) => setHits(r.hits)).catch(() => setHits([])); }, 260);
    return () => clearTimeout(t);
  }, [query, projectId]);

  const tab = tabs.find((t) => t.path === active);
  const dirty = !!tab && tab.draft !== tab.body.text;

  const save = useCallback(async () => {
    if (!tab || tab.body.readOnly) return;
    setSaving(true);
    try {
      const body = await api.saveFile(projectId, tab.path, tab.draft);
      setTabs((t) => t.map((x) => (x.path === tab.path ? { ...x, body, draft: body.text } : x)));
      toast(`Saved ${tab.path}`, 'ok');
    } catch (e) { toast((e as Error).message, 'error'); } finally { setSaving(false); }
  }, [tab, projectId]);

  const revert = async () => {
    if (!tab) return;
    const yes = await ask({
      title: `Put ${tab.path} back?`,
      body: 'It returns to exactly what the last commit has.',
      points: ['anything unsaved in this tab goes too', 'other files are untouched'],
      confirmLabel: 'Revert the file',
      icon: 'undo',
      danger: true,
    });
    if (!yes) return;
    try {
      const r = await api.revertFile(projectId, tab.path);
      toast(r.message, r.ok ? 'ok' : 'error');
      if (r.ok) { const body = await api.file(projectId, tab.path); setTabs((t) => t.map((x) => (x.path === tab.path ? { path: tab.path, body, draft: body.text } : x))); }
    } catch (e) { toast((e as Error).message, 'error'); }
  };

  const close = async (path: string) => {
    const t = tabs.find((x) => x.path === path);
    if (t && t.draft !== t.body.text) {
      const yes = await ask({
        title: `${path} has unsaved changes.`,
        body: 'Closing the tab throws away what you typed.',
        confirmLabel: 'Close anyway',
        cancelLabel: 'Keep editing',
        danger: true,
      });
      if (!yes) return;
    }
    setTabs((all) => all.filter((x) => x.path !== path));
    if (active === path) setActive(tabs.filter((x) => x.path !== path).at(-1)?.path ?? '');
  };

  // Ctrl/Cmd+S saves whatever is in front of you, the way every editor does.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); void save(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [save]);

  return (
    <div className="h-full flex flex-col bg-ink">
      <div className="h-11 shrink-0 flex items-center gap-2 px-3 border-b border-line">
        <Icon name="folder" size={14} className="text-bone-3 shrink-0" />
        <div className="flex-1 min-w-0 max-w-[340px]">
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a file, or a phrase inside one" className="!h-7 !text-[12.5px]" />
        </div>
        <div className="flex-1 min-w-0" />
        <div className="flex items-center gap-1.5 shrink-0">
          {tab && !tab.body.readOnly && (
            <>
              <Button size="sm" variant="quiet" icon="undo" onClick={revert} title="Back to the last commit">Revert</Button>
              <Button size="sm" variant={dirty ? 'primary' : 'quiet'} icon="check" busy={saving} disabled={!dirty} onClick={save}>
                {dirty ? 'Save' : 'Saved'}
              </Button>
            </>
          )}
          <Button size="sm" variant="quiet" icon="x" onClick={onClose} title="Close the file panel" />
        </div>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-[minmax(200px,240px)_1fr]">
        <div className="min-h-0 overflow-auto border-r border-line py-2">
          {hits ? (
            <SearchHits hits={hits} onOpen={open} />
          ) : (
            <Tree projectId={projectId} onOpen={open} active={active} />
          )}
        </div>

        <div className="min-h-0 flex flex-col">
          {tabs.length > 0 && (
            <div className="h-9 shrink-0 flex items-end gap-px overflow-x-auto border-b border-line px-1">
              {tabs.map((t) => {
                const on = t.path === active;
                const d = t.draft !== t.body.text;
                return (
                  <button
                    key={t.path} onClick={() => setActive(t.path)}
                    className={cx('h-8 pl-3 pr-2 rounded-t-lg text-[12.5px] inline-flex items-center gap-2 shrink-0 border border-b-0', on ? 'bg-ink-2 border-line text-bone' : 'border-transparent text-bone-3 hover:text-bone')}
                  >
                    <span className="truncate max-w-[180px]">{t.path.split('/').pop()}</span>
                    {d && <span className="w-1.5 h-1.5 rounded-full bg-volt shrink-0" />}
                    <span onClick={(e) => { e.stopPropagation(); close(t.path); }} className="text-bone-4 hover:text-bone"><Icon name="x" size={11} /></span>
                  </button>
                );
              })}
            </div>
          )}

          {!tab ? (
            <div className="flex-1 grid place-items-center text-center px-8">
              <div className="max-w-[46ch]">
                <Icon name="doc" size={26} className="text-bone-4 mx-auto" />
                <p className="text-bone-2 mt-3 text-[13.5px]">Pick a file on the left. Everything in the project is here, and everything you change is saved into the folder on your machine.</p>
                <div className="flex flex-wrap gap-2 justify-center mt-4">
                  {['.env.local', 'design.config.ts', 'app/page.tsx', 'BRIEF.md'].map((p) => (
                    <button key={p} className="chip" onClick={() => void open(p)}>{p}</button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <>
              {tab.body.secret && (
                <div className="shrink-0 px-4 py-2 text-[12.5px] text-bone-2 bg-volt-2 border-b border-line flex items-center gap-2">
                  <Icon name="lock" size={13} className="text-volt shrink-0" />
                  This file holds your keys. It is never committed and never leaves this machine — but do not paste it into a chat.
                </div>
              )}
              <Editor
                key={tab.path}
                body={tab.body}
                value={tab.draft}
                onChange={(v) => setTabs((t) => t.map((x) => (x.path === tab.path ? { ...x, draft: v } : x)))}
              />
              <div className="h-7 shrink-0 flex items-center justify-between px-3 border-t border-line telemetry text-bone-4">
                <span className="truncate min-w-0">{tab.path}</span>
                <span className="flex items-center gap-3 shrink-0">
                  <span>{tab.body.language}</span>
                  <span>{tab.draft.split('\n').length} lines</span>
                  {dirty && <span className="text-volt">unsaved · ctrl-s</span>}
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function SearchHits({ hits, onOpen }: { hits: Array<{ path: string; line?: number; text?: string }>; onOpen: (p: string) => void }) {
  if (!hits.length) return <div className="px-3 py-4 text-[13px] text-bone-3">Nothing matched.</div>;
  return (
    <ul className="px-1">
      {hits.map((h, i) => (
        <li key={`${h.path}:${h.line ?? 0}:${i}`}>
          <button onClick={() => onOpen(h.path)} className="w-full text-left px-2 py-1.5 rounded-md hover:bg-ink-3">
            <div className="text-[12.5px] truncate">{h.path}</div>
            {h.text && <div className="telemetry text-bone-4 truncate">{h.line}: {h.text}</div>}
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * Lazily loaded, one directory at a time.
 *
 * Walking the whole project up front would mean reading a few thousand stats
 * before anything appeared, and the one folder everybody actually wants is the
 * root. Children arrive when a folder is opened, and the four folders worth
 * opening are opened for you.
 */
function Tree({ projectId, onOpen, active }: { projectId: string; onOpen: (p: string) => void; active: string }) {
  const [dirs, setDirs] = useState<Record<string, FileEntry[]>>({});
  const [openDirs, setOpenDirs] = useState<Set<string>>(new Set(['']));
  const [busy, setBusy] = useState<Set<string>>(new Set());

  const load = useCallback(async (path: string) => {
    setBusy((b) => new Set(b).add(path));
    try { const r = await api.files(projectId, path); setDirs((d) => ({ ...d, [path]: r.entries })); }
    catch (e) { toast((e as Error).message, 'error'); }
    finally { setBusy((b) => { const n = new Set(b); n.delete(path); return n; }); }
  }, [projectId]);

  useEffect(() => { void load(''); }, [load]);

  const toggle = (path: string) => {
    setOpenDirs((o) => {
      const n = new Set(o);
      if (n.has(path)) n.delete(path); else { n.add(path); if (!dirs[path]) void load(path); }
      return n;
    });
  };

  const render = (path: string, depth: number): React.ReactNode => {
    const entries = dirs[path];
    if (!entries) return busy.has(path) ? <div style={{ paddingLeft: 12 + depth * 12 }} className="py-1"><Spinner size={11} /></div> : null;
    return entries.map((e) => (
      <div key={e.path}>
        <button
          onClick={() => (e.dir ? toggle(e.path) : onOpen(e.path))}
          className={cx('w-full text-left flex items-center gap-1.5 pr-2 py-[3px] rounded-md hover:bg-ink-3 text-[12.5px]', active === e.path && 'bg-ink-2 text-bone')}
          style={{ paddingLeft: 8 + depth * 12 }}
        >
          {e.dir
            ? <Icon name="chevronDown" size={11} className={cx('text-bone-4 shrink-0 transition-transform', !openDirs.has(e.path) && '-rotate-90')} />
            : <span className="w-[11px] shrink-0" />}
          <Icon name={iconForFile(e.name, e.dir)} size={12} className={cx('shrink-0', e.secret ? 'text-volt' : e.dir ? 'text-bone-3' : 'text-bone-4')} />
          <span className={cx('truncate', e.changed && 'text-volt')}>{e.name}</span>
        </button>
        {e.dir && openDirs.has(e.path) && render(e.path, depth + 1)}
      </div>
    ));
  };

  return <div className="px-1">{render('', 0)}</div>;
}

function Editor({ body, value, onChange }: { body: FileBody; value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  // A file ending in a newline draws one fewer line box than the textarea
  // reserves, so the last line of a long file sits a row out of register.
  const painted = useMemo(() => highlight(value.endsWith('\n') ? value + ' ' : value, body.language), [value, body.language]);

  if (body.readOnly) {
    return (
      <div className="flex-1 grid place-items-center text-center px-8">
        <div className="max-w-[44ch]">
          <Icon name="alert" size={22} className="text-bone-4 mx-auto" />
          <p className="text-bone-2 mt-3 text-[13.5px]">{body.reason ?? 'This file cannot be edited here.'}</p>
        </div>
      </div>
    );
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Tab') return;
    // Tab indents rather than leaving the editor. Shift-Tab is left to the
    // browser so keyboard users can still get out of the field backwards.
    if (e.shiftKey) return;
    e.preventDefault();
    const el = e.currentTarget;
    const { selectionStart: a, selectionEnd: b } = el;
    onChange(value.slice(0, a) + '  ' + value.slice(b));
    requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = a + 2; });
  };

  return (
    <div className="flex-1 min-h-0 overflow-auto bg-ink">
      <div className="relative min-h-full min-w-max">
        <pre aria-hidden className="tokens block text-bone-2" style={TYPE} dangerouslySetInnerHTML={{ __html: painted }} />
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          className="absolute inset-0 w-full h-full bg-transparent text-transparent caret-[color:var(--color-volt)] resize-none outline-none overflow-hidden selection:bg-volt/25"
          style={TYPE}
        />
      </div>
    </div>
  );
}
