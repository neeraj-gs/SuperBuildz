/**
 * Several conversations about one project, side by side.
 *
 * ── Why more than one ───────────────────────────────────────────────────────
 *
 * Because a build is not one task. Somebody wants the menu page rewritten and
 * the colours tried three ways and the booking form fixed, and running those
 * through one conversation means each waits for the last and the transcript
 * becomes a place nobody can find anything. Three tabs is the shape everybody
 * already understands.
 *
 * ── And why they are not independent ────────────────────────────────────────
 *
 * The moment a project has more than one conversation, they stop being one
 * assistant and become several with amnesia — one rewriting a page another has
 * been told is fine. So every conversation's prompt carries the project's
 * shared notes and a line about what the others are doing right now. The
 * notebook is behind the button at the end of this bar; the log in it writes
 * itself.
 *
 * ── The queue is shown, not hidden ──────────────────────────────────────────
 *
 * This machine runs as many at once as it comfortably can and the rest wait.
 * A person whose message has not started deserves to know it is second in line
 * rather than watch a spinner that means nothing.
 */

import { useEffect, useState } from 'react';
import type { Session } from '@superbuilds/protocol';
import { api } from '@/lib/api';
import { useStore, toast } from '@/lib/store';
import { Button, Spinner, cx } from '@/components/ui';
import { Icon } from '@/components/icons';

export function SessionTabs({ projectId, activeId, onPick, onNotes }: {
  projectId: string;
  activeId?: string;
  onPick: (id: string) => void;
  onNotes: () => void;
}) {
  const store = useStore((s) => s.sessions);
  const capacity = useStore((s) => s.capacity);
  const [ids, setIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.sessions(projectId)
      .then((list) => {
        setIds(list.map((s) => s.id));
        for (const s of list) useStore.getState().apply({ type: 'session.upsert', session: s });
      })
      .catch(() => {});
  }, [projectId]);

  // A conversation deleted anywhere disappears from the store; keep the tabs in step.
  useEffect(() => { setIds((prev) => prev.filter((id) => store[id])); }, [store]);

  const sessions = ids.map((id) => store[id]).filter(Boolean) as Session[];
  const waiting = new Map((capacity?.waiting ?? []).map((w) => [w.sessionId, w.position]));

  const add = async () => {
    setBusy(true);
    try {
      const s = await api.newSession(projectId);
      useStore.getState().apply({ type: 'session.upsert', session: s });
      setIds((prev) => [...prev, s.id]);
      onPick(s.id);
    } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  };

  const rename = async (s: Session) => {
    const title = prompt('Call this conversation what?', s.title)?.trim();
    if (!title || title === s.title) return;
    try { useStore.getState().apply({ type: 'session.upsert', session: await api.renameSession(s.id, title) }); }
    catch (e) { toast((e as Error).message, 'error'); }
  };

  const close = async (s: Session) => {
    if (!confirm(`Close “${s.title}”? The transcript goes; everything it built stays, and it is all in git.`)) return;
    try {
      await api.deleteSession(s.id);
      setIds((prev) => prev.filter((id) => id !== s.id));
      if (activeId === s.id) onPick(ids.find((id) => id !== s.id) ?? '');
    } catch (e) { toast((e as Error).message, 'error'); }
  };

  // One conversation is the ordinary case and does not need a tab bar for it.
  if (sessions.length <= 1 && !waiting.size) {
    return (
      <div className="h-9 shrink-0 flex items-center justify-between gap-2 px-2 border-b border-line">
        <span className="telemetry text-bone-4 pl-1 truncate">{sessions[0]?.title ?? 'Conversation'}</span>
        <span className="flex items-center gap-1 shrink-0">
          <Button size="sm" variant="quiet" icon="book" onClick={onNotes} title="Shared notes every conversation reads">Notes</Button>
          <Button size="sm" variant="quiet" icon="plus" busy={busy} onClick={add} title="Another conversation about this project" />
        </span>
      </div>
    );
  }

  return (
    <div className="shrink-0 border-b border-line">
      <div className="h-9 flex items-end gap-px px-1 overflow-x-auto">
        {sessions.map((s) => {
          const on = s.id === activeId;
          const place = waiting.get(s.id);
          return (
            <button
              key={s.id}
              onClick={() => onPick(s.id)}
              onDoubleClick={() => rename(s)}
              title={place ? `Number ${place} in line` : s.status === 'running' ? 'Replying now' : 'Double-click to rename'}
              className={cx(
                'h-8 pl-3 pr-2 rounded-t-lg text-[12.5px] inline-flex items-center gap-2 shrink-0 border border-b-0 max-w-[190px]',
                on ? 'bg-ink-2 border-line text-bone' : 'border-transparent text-bone-3 hover:text-bone',
              )}
            >
              {place ? <span className="telemetry text-warn shrink-0">{place}</span>
                : s.status === 'running' ? <Spinner size={10} className="text-volt shrink-0" />
                : <span className="w-[6px] h-[6px] rounded-full bg-bone-4 shrink-0" />}
              <span className="truncate">{s.title}</span>
              {sessions.length > 1 && (
                <span onClick={(e) => { e.stopPropagation(); void close(s); }} className="text-bone-4 hover:text-danger shrink-0"><Icon name="x" size={11} /></span>
              )}
            </button>
          );
        })}
        <span className="flex-1" />
        <span className="flex items-center gap-1 pb-1 shrink-0">
          <Button size="sm" variant="quiet" icon="book" onClick={onNotes} title="Shared notes every conversation reads">Notes</Button>
          <Button size="sm" variant="quiet" icon="plus" busy={busy} onClick={add} title="Another conversation about this project" />
        </span>
      </div>

      {capacity && capacity.waiting.length > 0 && (
        <p className="px-3 py-1.5 telemetry text-warn border-t border-line">
          {capacity.running} of {capacity.ceiling} running · {capacity.waiting.length} waiting. They start on their own.
        </p>
      )}
    </div>
  );
}

/**
 * The notebook.
 *
 * Everything above the log is the person's, read by every conversation about
 * this project on every turn — the things they would otherwise have to keep
 * repeating. Everything below it writes itself, one line per finished turn, so
 * a conversation opened tomorrow knows what happened today.
 */
export function NotesPanel({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const [text, setText] = useState<string | null>(null);
  const [saved, setSaved] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.memory(projectId).then((m) => { setText(m.text); setSaved(m.text); }).catch((e) => toast(e.message, 'error'));
  }, [projectId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const dirty = text !== null && text !== saved;

  const save = async () => {
    if (text === null) return;
    setSaving(true);
    try { const m = await api.setMemory(projectId, text); setText(m.text); setSaved(m.text); toast('Saved. Every conversation reads this from its next message.', 'ok'); }
    catch (e) { toast((e as Error).message, 'error'); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-ink/85 backdrop-blur-sm grid place-items-center p-4 fade" onClick={onClose}>
      <div className="panel w-[min(760px,100%)] h-[min(80vh,760px)] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-start justify-between gap-4 px-5 py-4 border-b border-line">
          <div>
            <h2 className="d4">Shared notes</h2>
            <p className="text-[13px] text-bone-3 mt-1 measure">
              Read by every conversation about this project, every time. Put the things you would
              otherwise keep repeating — what the business is really like, words to use, words never
              to use, a decision you do not want revisited.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" variant={dirty ? 'primary' : 'quiet'} icon="check" busy={saving} disabled={!dirty} onClick={save}>{dirty ? 'Save' : 'Saved'}</Button>
            <Button size="sm" variant="quiet" icon="x" onClick={onClose} />
          </div>
        </header>

        {text === null ? (
          <div className="flex-1 grid place-items-center"><Spinner /></div>
        ) : (
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
            className="flex-1 min-h-0 w-full bg-ink text-bone-2 resize-none outline-none px-5 py-4 font-[family-name:var(--font-mono)] text-[12.5px] leading-[1.62]"
          />
        )}

        <footer className="px-5 py-2.5 border-t border-line telemetry text-bone-4">
          .superbuilds/memory.md · the log below the heading writes itself, one line per finished turn
        </footer>
      </div>
    </div>
  );
}
