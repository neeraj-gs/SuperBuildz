/**
 * One conversation with Claude Code about one project.
 *
 * A session is a persistent `claude -p` process with stdin open between
 * turns, so a follow-up reaches something that remembers the last one. The
 * transcript lives on disk as JSON; the process is incidental and is restarted
 * with `--resume` if it has gone.
 *
 * Every turn: checkpoint first, commit after, so "undo that" is always a
 * button. Replies are streamed as deltas and finalised from the complete text
 * blocks; the options block at the end becomes chips.
 */

import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { splitOptions, type Session, type ToolCall, type Turn } from '@superbuilds/protocol';
import { startSession, resultError, writeHookSettings, type SessionHandle } from './claude.ts';
import { checkpointsDir, getSession, saveSession, removeSession } from './store.ts';
import { takeSnapshot, restoreSnapshot, pruneSnapshots } from './checkpoints.ts';
import { broadcast } from './bus.ts';
import { execPlain } from './binaries.ts';
import { systemPromptFor } from './brief.ts';
import { admitOrQueue, configureCapacity, drain, unqueue } from './capacity.ts';
import { memoryPrompt, noteTurn } from './memory.ts';
import { listSessions } from './store.ts';

interface Live {
  handle: SessionHandle;
  /**
   * `total_cost_usd` on a result record is cumulative for the process, not
   * per turn — observed on a real build: 5.93, 13.78, 20.90, 29.25 across four
   * stages, then 30.37 for a one-minute follow-up. Summing those would report
   * $70 for a $30 build. So a turn's cost is the delta from the last result.
   */
  costBase: number;
  /** The turn currently streaming, if any. */
  turn?: { id: string; text: string; blocks: string[]; tools: Map<string, ToolCall>; startedAt: number; resolve: (t: Turn) => void; reject: (e: Error) => void };
  /** A note to prepend to the next user message (after a rewind). */
  note?: string;
  projectPath: string;
  projectName: string;
}

const live = new Map<string, Live>();

/*
  How many conversations are mid-turn right now, across every project.

  This is the number the ceiling is compared against, and it counts turns rather
  than processes on purpose: a session with its process warm but nothing to say
  costs almost nothing, and refusing to start a new one because four idle ones
  exist would be the wrong kind of careful.
*/
configureCapacity({ countLive: () => [...live.values()].filter((l) => l.turn).length });
let hookPort = 0;
let hookToken = '';

export function configureHooks(port: number, token: string) { hookPort = port; hookToken = token; }

export function createSession(projectId: string, title: string): Session {
  const s: Session = {
    id: randomUUID(), projectId, title, createdAt: Date.now(), updatedAt: Date.now(), status: 'idle', turns: [], costUsd: 0,
  };
  saveSession(s);
  broadcast({ type: 'session.upsert', session: s });
  return s;
}

/** Rename a conversation. The name is what the other conversations see it as. */
export function renameSession(id: string, title: string): Session | undefined {
  const s = getSession(id);
  if (!s) return undefined;
  return save({ ...s, title, updatedAt: Date.now() });
}

/**
 * Delete a conversation.
 *
 * The transcript goes and the process with it; the project, its files and its
 * git history are untouched. There is no undo because there is nothing to undo
 * — everything a conversation did was committed as it went, and the shared
 * notes keep the line it wrote.
 *
 * Distinct from `closeSession`, which ends the process and keeps the transcript
 * and is what shutdown calls.
 */
export function deleteSession(id: string): void {
  closeSession(id);
  unqueue(id);
  removeSession(id);
  broadcast({ type: 'session.remove', sessionId: id });
  // A slot may have just come free.
  drain();
}

export function sessionIsBusy(id: string): boolean {
  return !!live.get(id)?.turn;
}

function save(session: Session): Session {
  const saved = saveSession(session);
  broadcast({ type: 'session.upsert', session: saved });
  return saved;
}

function ensureProcess(session: Session, projectPath: string, projectName: string, opts: { model?: string; budgetUsd?: number; stage?: string }): Live {
  const existing = live.get(session.id);
  if (existing && existing.handle.child.exitCode === null) return existing;

  const settingsFile = hookPort ? writeHookSettings(hookPort, hookToken) : undefined;
  const handle = startSession({
    cwd: projectPath,
    sessionId: session.id,
    resumeSessionId: session.claudeSessionId,
    systemPrompt: [
      systemPromptFor(projectName, { stage: opts.stage }),
      // What the other conversations about this project know and are doing.
      // Composed per process rather than per turn because the system prompt is
      // fixed for the life of the process; the log inside it is refreshed
      // whenever a process is restarted, which a long session does often.
      memoryPrompt(projectPath, othersOn(session)),
    ].filter(Boolean).join('\n\n'),
    model: opts.model,
    maxBudgetUsd: opts.budgetUsd,
    permissionMode: 'bypassPermissions',
    settingsFile,
    addDirs: [],
  }, {
    onInit: (rec) => {
      const id = String(rec.session_id ?? '');
      if (id) { const s = getSession(session.id); if (s && s.claudeSessionId !== id) save({ ...s, claudeSessionId: id, model: String(rec.model ?? s.model ?? '') }); }
    },
    onTextDelta: (text) => {
      const l = live.get(session.id); if (!l?.turn) return;
      l.turn.text += text;
      broadcast({ type: 'session.delta', sessionId: session.id, turnId: l.turn.id, text });
    },
    onThinkingDelta: (text) => {
      const l = live.get(session.id); if (!l?.turn) return;
      broadcast({ type: 'session.thinking', sessionId: session.id, turnId: l.turn.id, text });
    },
    onAssistantText: (text) => {
      const l = live.get(session.id); if (!l?.turn) return;
      l.turn.blocks.push(text);
    },
    onToolUse: (call) => {
      const l = live.get(session.id); if (!l?.turn) return;
      const tool: ToolCall = { id: call.id, name: call.name, input: call.input, at: Date.now() };
      l.turn.tools.set(call.id, tool);
      broadcast({ type: 'session.tool', sessionId: session.id, turnId: l.turn.id, tool });
    },
    onToolResult: (res) => {
      const l = live.get(session.id); if (!l?.turn) return;
      const tool = l.turn.tools.get(res.id);
      if (!tool) return;
      tool.result = res.content.slice(0, 4000);
      tool.isError = res.isError;
      broadcast({ type: 'session.tool', sessionId: session.id, turnId: l.turn.id, tool });
    },
    onUsage: (used, limit) => {
      const s = getSession(session.id); if (s) save({ ...s, contextUsed: used, contextLimit: limit });
    },
    onResult: (rec) => {
      const l = live.get(session.id); if (!l?.turn) return;
      void finishTurn(session.id, rec);
    },
    onExit: (code) => {
      const l = live.get(session.id);
      if (l?.turn) {
        const err = new Error(`Claude Code exited (${code}) before finishing the reply.`);
        const s = getSession(session.id);
        if (s) {
          const turn: Turn = { id: l.turn.id, role: 'assistant', text: l.turn.text, at: Date.now(), tools: [...l.turn.tools.values()], error: err.message };
          save({ ...s, status: 'error', turns: [...s.turns.filter((t) => t.id !== turn.id), turn] });
          broadcast({ type: 'session.turn', sessionId: session.id, turn });
        }
        l.turn.reject(err);
        l.turn = undefined;
      }
      live.delete(session.id);
    },
  });

  const entry: Live = { handle, projectPath, projectName, costBase: 0 };
  live.set(session.id, entry);
  return entry;
}

async function commitAll(projectPath: string, message: string) {
  if (!existsSync(join(projectPath, '.git'))) return;
  await execPlain('git', ['-C', projectPath, 'add', '-A'], 60_000);
  await execPlain('git', ['-C', projectPath, '-c', 'user.name=Super Builds', '-c', 'user.email=superbuilds@localhost', 'commit', '-q', '-m', message.slice(0, 200), '--no-verify'], 60_000);
}

async function finishTurn(sessionId: string, rec: Record<string, unknown>) {
  const l = live.get(sessionId);
  const s = getSession(sessionId);
  if (!l?.turn || !s) return;
  const t = l.turn;
  l.turn = undefined;

  const raw = (t.blocks.length ? t.blocks.join('\n\n') : t.text).trim();
  const { text, options } = splitOptions(raw);
  const error = resultError(rec as never);
  const cumulative = Number(rec.total_cost_usd ?? 0);
  const turnCost = Math.max(0, cumulative - l.costBase);
  l.costBase = cumulative;
  const turn: Turn = {
    id: t.id, role: 'assistant', text: text || (error ? '' : raw), at: Date.now(),
    tools: [...t.tools.values()], options, costUsd: turnCost, durationMs: Date.now() - t.startedAt,
    error: error ?? undefined,
  };
  const stageOf = s.turns.findLast((x) => x.role === 'user')?.stage;
  if (stageOf) turn.stage = stageOf;

  const next: Session = {
    ...s, status: error ? 'error' : 'idle',
    turns: [...s.turns.filter((x) => x.id !== turn.id), turn],
    costUsd: (s.costUsd ?? 0) + (turn.costUsd ?? 0),
  };
  save(next);
  broadcast({ type: 'session.turn', sessionId, turn });

  await commitAll(l.projectPath, `Super Builds: ${stageOf ? `stage ${stageOf}` : 'change'} — ${(s.turns.findLast((x) => x.role === 'user')?.text ?? '').split('\n')[0].slice(0, 80)}`);

  // One line in the project's shared notes, so every other conversation about
  // it knows what just happened without anybody having to paste anything.
  if (!error && turn.text) noteTurn(l.projectPath, s.title, turn.text);

  if (error) t.reject(new Error(error)); else t.resolve(turn);
}

export interface TurnOptions { stage?: string; model?: string; budgetUsd?: number; checkpoint?: boolean; label?: string }

/** Send a message; resolves with the assistant's finished turn. */
export async function sendTurn(sessionId: string, text: string, projectPath: string, projectName: string, opts: TurnOptions = {}): Promise<Turn> {
  const s = getSession(sessionId);
  if (!s) throw new Error('That conversation no longer exists.');
  if (live.get(sessionId)?.turn) throw new Error('Claude is still replying. Stop it first, or wait.');

  const userTurn: Turn = { id: randomUUID(), role: 'user', text, at: Date.now(), stage: opts.stage };
  if (opts.checkpoint !== false) {
    const dir = join(checkpointsDir(sessionId), userTurn.id);
    const snap = await takeSnapshot(projectPath, dir);
    if (snap.ok && snap.fileCount >= 0) userTurn.checkpointId = userTurn.id;
    pruneSnapshots(checkpointsDir(sessionId), 30);
  }

  const assistantTurn: Turn = { id: randomUUID(), role: 'assistant', text: '', at: Date.now(), partial: true, stage: opts.stage };
  save({ ...s, status: 'running', turns: [...s.turns, userTurn, assistantTurn] });
  broadcast({ type: 'session.turn', sessionId, turn: userTurn });

  /*
    Over the ceiling, this waits its turn rather than being refused.

    The whole promise is handed to the queue, so the caller — a chat message or
    a build stage — simply takes longer to resolve and never has to know. The
    conversation shows "second in line" in the meantime, which is the honest
    thing to say and better than a spinner that means nothing.
  */
  return new Promise<Turn>((resolve, reject) => {
    const start = () => new Promise<void>((settle) => {
      const l = ensureProcess(s, projectPath, projectName, { model: opts.model, budgetUsd: opts.budgetUsd, stage: opts.stage });
      const note = l.note; l.note = undefined;
      l.turn = {
        id: assistantTurn.id, text: '', blocks: [], tools: new Map(), startedAt: Date.now(),
        // Settling the outer promise and releasing the queue slot are the same
        // moment; separating them is how a slot leaks.
        resolve: (t) => { resolve(t); settle(); },
        reject: (e) => { reject(e); settle(); },
      };
      l.handle.send(note ? `${note}\n\n${text}` : text);
    });

    const { started, position } = admitOrQueue({ sessionId, projectId: s.projectId, title: s.title, start });
    if (!started) {
      save({ ...getSession(sessionId)!, status: 'running' });
      broadcast({
        type: 'session.turn',
        sessionId,
        turn: { id: `queued-${assistantTurn.id}`, role: 'system', at: Date.now(),
          text: `Waiting: this machine is running as many conversations at once as it comfortably can. This one is number ${position} in line and starts on its own.` },
      });
    }
  });
}

/**
 * The other conversations about the same project that are mid-turn.
 *
 * What each is "doing" is the first line of the message it was last sent — the
 * person's own words for the task, which is a better description of the work
 * than anything that could be inferred from it.
 */
function othersOn(session: Session): Array<{ title: string; doing: string }> {
  return listSessions(session.projectId)
    .filter((o) => o.id !== session.id && live.get(o.id)?.turn)
    .map((o) => {
      const lastUser = [...o.turns].reverse().find((t) => t.role === 'user');
      const doing = (lastUser?.text ?? '').split('\n')[0].trim().slice(0, 140);
      return { title: o.title, doing: doing || 'working on this project' };
    })
    .slice(0, 4);
}

export async function stopTurn(sessionId: string): Promise<'stopped' | 'killed' | 'idle'> {
  const l = live.get(sessionId);
  // Stopping something that has not started yet takes it out of the line, which
  // is the only way a queued turn can be cancelled.
  if (!l?.turn) return unqueue(sessionId) ? 'stopped' : 'idle';
  const how = await l.handle.interrupt();
  // The interrupt produces a result record; if it does not, close out here.
  setTimeout(() => {
    const still = live.get(sessionId);
    if (still?.turn) {
      const s = getSession(sessionId);
      const turn: Turn = { id: still.turn.id, role: 'assistant', text: still.turn.text, at: Date.now(), tools: [...still.turn.tools.values()], error: 'Stopped.' };
      if (s) { save({ ...s, status: 'idle', turns: [...s.turns.filter((t) => t.id !== turn.id), turn] }); broadcast({ type: 'session.turn', sessionId, turn }); }
      still.turn.reject(new Error('Stopped.'));
      still.turn = undefined;
    }
  }, 1500);
  return how;
}

/** Put the folder back to before `turnId` (a user turn) and forget what came after. */
export async function rewindTo(sessionId: string, turnId: string, projectPath: string): Promise<{ ok: boolean; message: string }> {
  const s = getSession(sessionId);
  if (!s) return { ok: false, message: 'That conversation no longer exists.' };
  if (live.get(sessionId)?.turn) return { ok: false, message: 'Claude is still replying. Stop it first.' };
  const idx = s.turns.findIndex((t) => t.id === turnId);
  const turn = s.turns[idx];
  if (idx === -1 || !turn.checkpointId) return { ok: false, message: 'There is no checkpoint for that message.' };

  /*
    Every turn commits when it finishes, so the snapshot taken before a turn is
    usually empty (the tree was clean) and the change to undo is a commit. The
    manifest recorded HEAD at snapshot time; reset to that, then lay the
    snapshot's copies (pre-existing uncommitted work) back on top.
  */
  const snapDir = join(checkpointsDir(sessionId), turn.checkpointId);
  let head = 'HEAD';
  try { head = (JSON.parse(readFileSync(join(snapDir, 'manifest.json'), 'utf8')) as { head?: string }).head || 'HEAD'; } catch { /* fall back to HEAD */ }
  await execPlain('git', ['-C', projectPath, 'reset', '-q', '--hard', head], 60_000);
  const res = await restoreSnapshot(projectPath, snapDir);
  if (!res.ok) return res;

  const dropped = s.turns.slice(idx);
  save({ ...s, turns: s.turns.slice(0, idx), status: 'idle' });
  const l = live.get(sessionId);
  const summary = dropped.filter((t) => t.role === 'user').map((t) => `"${t.text.split('\n')[0].slice(0, 80)}"`).join(', ');
  const note = `[Super Builds] The person pressed Undo. The files have been restored to how they were before ${summary}. Treat everything you did for those messages as not having happened, and do not redo it unless asked.`;
  if (l) l.note = note; else pendingNotes.set(sessionId, note);
  await commitAll(projectPath, 'Super Builds: undo');
  const n = dropped.filter((t) => t.role === 'assistant').length;
  return { ok: true, message: `Undone: ${n} change${n === 1 ? '' : 's'} reverted, the site is as it was before that message. ${res.restored ? res.message : ''}`.trim() };
}

const pendingNotes = new Map<string, string>();

/** Called by ensureProcess's caller when a process is (re)started after a rewind. */
export function takePendingNote(sessionId: string): string | undefined {
  const n = pendingNotes.get(sessionId);
  pendingNotes.delete(sessionId);
  return n;
}

export function closeSession(sessionId: string) {
  const l = live.get(sessionId);
  if (!l) return;
  l.handle.close();
  setTimeout(() => l.handle.kill(), 3_000).unref();
  live.delete(sessionId);
}

export function closeAll() {
  for (const id of [...live.keys()]) closeSession(id);
}
