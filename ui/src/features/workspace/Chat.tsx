/**
 * The conversation. Replies stream in, tool calls fold into one line each,
 * and every assistant reply ends in chips — the options Claude offered —
 * because the people this is for press rather than type. Every user turn has
 * an Undo that puts the folder back to before it.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Session, Turn, ToolCall, Choice } from '@superbuilds/protocol';
import { api } from '@/lib/api';
import { useStore, toast } from '@/lib/store';
import { Button, Markdown, Spinner, Textarea, cx } from '@/components/ui';
import { Icon } from '@/components/icons';

export function Chat({ session, projectId, busy }: { session: Session; projectId: string; busy: boolean }) {
  const streaming = useStore((s) => s.streaming);
  const thinking = useStore((s) => s.thinking);
  const [text, setText] = useState('');
  const [changes, setChanges] = useState<Choice[]>([]);
  const [changeOpen, setChangeOpen] = useState<Choice | null>(null);
  const [changeNote, setChangeNote] = useState('');
  const [showTools, setShowTools] = useState<Record<string, boolean>>({});
  const [showThinking, setShowThinking] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const running = session.status === 'running';

  useEffect(() => { void api.changes().then(setChanges).catch(() => {}); }, []);
  const lastText = session.turns.at(-1)?.id;
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [session.turns.length, lastText, streaming[session.turns.at(-1)?.id ?? '']]);

  const send = async (t: string) => {
    const msg = t.trim(); if (!msg) return;
    try { await api.turn(session.id, msg); setText(''); } catch (e) { toast((e as Error).message, 'error'); }
  };
  const stop = async () => { try { await api.stop(session.id); } catch (e) { toast((e as Error).message, 'error'); } };
  const undo = async (turnId: string) => {
    if (!confirm('Put the site back to before this message? Everything after it is undone.')) return;
    try { const r = await api.rewind(session.id, turnId); toast(r.message, r.ok ? 'ok' : 'error'); await useStore.getState().loadSession(session.id); } catch (e) { toast((e as Error).message, 'error'); }
  };
  const runChange = async () => {
    if (!changeOpen) return;
    try { await api.change(session.id, changeOpen.id, changeNote ? [changeNote] : [], undefined); setChangeOpen(null); setChangeNote(''); } catch (e) { toast((e as Error).message, 'error'); }
  };

  const lastAssistant = [...session.turns].reverse().find((t) => t.role === 'assistant' && !t.partial);
  const options = !running && lastAssistant?.options?.length ? lastAssistant.options : [];
  const visible = useMemo(() => session.turns.filter((t) => !(t.role === 'user' && t.stage) || true), [session.turns]);

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4">
        {visible.length === 0 && <div className="text-[13.5px] text-bone-3 text-center py-10">Say what you want changed, or press one of the actions below.</div>}
        {visible.map((t) => (
          <TurnView key={t.id} turn={t} stream={streaming[t.id]} think={thinking[t.id]} showTools={!!showTools[t.id]} toggleTools={() => setShowTools((s) => ({ ...s, [t.id]: !s[t.id] }))} onUndo={t.role === 'user' && t.checkpointId && !running ? () => undo(t.id) : undefined} showThinking={showThinking} />
        ))}
        <div ref={end} />
      </div>

      {/* Chips */}
      {options.length > 0 && (
        <div className="px-4 pb-2 flex flex-wrap gap-2">
          {options.map((o) => <button key={o} onClick={() => send(o)} className="chip !border-volt/50 text-[13px]"><Icon name="arrowRight" size={12} className="text-volt" />{o}</button>)}
        </div>
      )}

      {/* Quick actions */}
      {changes.length > 0 && !busy && (
        <div className="px-4 pb-2 flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {changes.map((c) => <button key={c.id} onClick={() => setChangeOpen(c)} className="chip shrink-0 !h-8 text-[12.5px]" title={c.blurb}><Icon name={c.icon ?? 'dots'} size={13} />{c.label}</button>)}
        </div>
      )}
      {changeOpen && (
        <div className="mx-4 mb-2 panel p-3">
          <div className="flex items-center justify-between"><span className="font-semibold text-[14px] flex items-center gap-2"><Icon name={changeOpen.icon ?? 'dots'} size={15} className="text-volt" />{changeOpen.label}</span><button onClick={() => setChangeOpen(null)} className="text-bone-3"><Icon name="x" size={14} /></button></div>
          <p className="text-[12.5px] text-bone-3 mt-0.5">{changeOpen.blurb}</p>
          <Textarea rows={2} className="mt-2" placeholder="Which page, what exactly? One line is enough. Optional." value={changeNote} onChange={(e) => setChangeNote(e.target.value)} />
          <div className="flex justify-end mt-2"><Button size="sm" variant="primary" icon="arrowRight" onClick={runChange}>Do it</Button></div>
        </div>
      )}

      {/* Input */}
      <div className="p-3 border-t border-line">
        <div className="flex items-end gap-2">
          <Textarea rows={2} placeholder={busy ? 'Building… you can still type; it will wait for a gap.' : 'Tell it what to change. Or press a chip.'} value={text} onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!running) void send(text); } }} />
          {running ? <Button variant="danger" icon="stop" onClick={stop}>Stop</Button> : <Button variant="primary" icon="send" onClick={() => send(text)} disabled={!text.trim()}>Send</Button>}
        </div>
        <div className="flex items-center justify-between mt-1.5 telemetry text-bone-4">
          <span>{running ? <span className="inline-flex items-center gap-1.5 text-volt"><Spinner size={10} /> Claude is working</span> : session.model ? `model ${session.model}` : 'ready'}</span>
          <span className="flex items-center gap-3">
            <button onClick={() => setShowThinking(!showThinking)} className={cx(showThinking && 'text-volt')}>thinking</button>
            {session.contextUsed && session.contextLimit ? <span>{Math.round((session.contextUsed / session.contextLimit) * 100)}% context</span> : null}
            <span>${session.costUsd.toFixed(2)}</span>
          </span>
        </div>
      </div>
    </div>
  );
}

function TurnView({ turn, stream, think, showTools, toggleTools, onUndo, showThinking }: { turn: Turn; stream?: string; think?: string; showTools: boolean; toggleTools: () => void; onUndo?: () => void; showThinking: boolean }) {
  if (turn.role === 'system') return <div className="telemetry text-danger border border-danger/30 rounded-lg px-3 py-2 bg-danger/5">{turn.text}</div>;
  if (turn.role === 'user') {
    const stage = turn.stage;
    return (
      <div className="flex justify-end group">
        <div className="max-w-[92%]">
          {stage ? (
            <div className="rounded-2xl rounded-br-md bg-ink-3 border border-line px-3.5 py-2 text-[13px] text-bone-2"><span className="legend !text-[10px] text-volt block mb-0.5">Stage · {stage}</span>{turn.text.split('\n')[0]}</div>
          ) : (
            <div className="rounded-2xl rounded-br-md bg-volt text-ink px-3.5 py-2.5 text-[14px] whitespace-pre-wrap">{turn.text}</div>
          )}
          {onUndo && <button onClick={onUndo} className="telemetry text-bone-4 hover:text-bone opacity-0 group-hover:opacity-100 transition-opacity mt-1 inline-flex items-center gap-1 float-right"><Icon name="undo" size={11} /> undo from here</button>}
        </div>
      </div>
    );
  }
  const text = turn.partial ? (stream ?? turn.text) : turn.text;
  const tools = turn.tools ?? [];
  return (
    <div className="max-w-[96%]">
      {showThinking && think && <div className="telemetry text-bone-4 italic border-l border-line pl-3 mb-2 whitespace-pre-wrap max-h-28 overflow-auto">{think.slice(-800)}</div>}
      {tools.length > 0 && (
        <div className="mb-2">
          <button onClick={toggleTools} className="telemetry text-bone-3 hover:text-bone inline-flex items-center gap-1.5">
            <Icon name="chevronDown" size={12} className={cx('transition-transform', showTools && 'rotate-180')} />
            {tools.length} step{tools.length === 1 ? '' : 's'}{turn.partial && <Spinner size={10} />}
            {!showTools && <span className="text-bone-4 truncate max-w-[260px]"> · {describe(tools.at(-1)!)}</span>}
          </button>
          {showTools && <ul className="mt-1.5 space-y-1">{tools.map((t) => <li key={t.id} className={cx('telemetry flex items-start gap-2', t.isError ? 'text-danger' : 'text-bone-3')}><Icon name={iconFor(t.name)} size={12} className="mt-0.5 shrink-0" /><span className="truncate">{describe(t)}</span></li>)}</ul>}
        </div>
      )}
      {text ? <Markdown text={text} className="text-[14px] text-bone" /> : turn.partial ? <div className="text-bone-3 telemetry inline-flex items-center gap-2"><Spinner size={11} /> thinking…</div> : null}
      {turn.error && <div className="telemetry text-danger mt-2">{turn.error}</div>}
      {!turn.partial && (turn.costUsd || turn.durationMs) ? <div className="telemetry text-bone-4 mt-1.5">{turn.durationMs ? `${Math.round(turn.durationMs / 1000)}s` : ''}{turn.costUsd ? ` · $${turn.costUsd.toFixed(2)}` : ''}</div> : null}
    </div>
  );
}

function iconFor(name: string) { return name === 'Bash' ? 'terminal' : name === 'Read' ? 'doc' : name === 'Write' || name === 'Edit' || name === 'MultiEdit' ? 'edit' : name === 'WebFetch' || name === 'WebSearch' ? 'globe' : name.startsWith('mcp__') ? 'link' : 'gear'; }
function describe(t: ToolCall): string {
  const i = (t.input ?? {}) as Record<string, unknown>;
  const short = (s: unknown) => String(s ?? '').replace(/\\/g, '/').split('/').slice(-2).join('/');
  switch (t.name) {
    case 'Bash': return `ran ${String(i.command ?? '').split('\n')[0].slice(0, 90)}`;
    case 'Read': return `read ${short(i.file_path)}`;
    case 'Write': return `wrote ${short(i.file_path)}`;
    case 'Edit': case 'MultiEdit': return `edited ${short(i.file_path)}`;
    case 'Glob': return `looked for ${i.pattern}`;
    case 'Grep': return `searched for ${i.pattern}`;
    case 'WebFetch': return `fetched ${i.url}`;
    case 'Agent': return `asked a helper: ${String(i.description ?? '').slice(0, 70)}`;
    default: return t.name.replace('mcp__', '').replace(/__/g, ' · ');
  }
}
