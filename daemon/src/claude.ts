/**
 * Claude Code as a process. One session = one `claude -p` with stream-json on
 * both pipes. Ported from PowerHouz, where each line of this was earned by a
 * spike rather than read from the docs:
 *
 *  - `system/init` arrives once PER TURN, not once per session
 *  - `total_cost_usd` on a result record is PER-TURN, so sum it
 *  - PermissionRequest never fires headless; PreToolUse always does, which is
 *    why the approval/deny hook is on PreToolUse
 *  - a turn can fail while the process succeeds: `result` with `is_error`
 */

import { spawn, execFile, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { PermissionMode, RateLimitInfo } from '@superbuilds/protocol';
import { findOnPath, spawnBin } from './binaries.ts';
import { superbuildsHome } from './paths.ts';

export interface ClaudeEvent {
  type: string;
  subtype?: string;
  [k: string]: unknown;
}

/** Detect the user's binary. Never bundle or install one silently. */
export function resolveClaudeBin(): string {
  const override = process.env.SUPERBUILDS_CLAUDE_BIN?.trim();
  if (override && existsSync(override)) return override;
  const exe = process.platform === 'win32' ? 'claude.exe' : 'claude';
  const local = join(homedir(), '.local', 'bin', exe);
  if (existsSync(local)) return local;
  return findOnPath('claude') ?? exe;
}

/**
 * NDJSON framing. Two things reliably break it: Windows CRLF, and chunk
 * boundaries landing mid-line.
 */
export function createNdjsonParser(
  onRecord: (rec: ClaudeEvent) => void,
  onMalformed?: (line: string, err: Error) => void,
) {
  let buffer = '';
  const consume = (line: string) => {
    const clean = line.replace(/\r$/, '');
    if (!clean.trim()) return;
    try { onRecord(JSON.parse(clean) as ClaudeEvent); } catch (err) { onMalformed?.(clean, err as Error); }
  };
  return {
    push(chunk: string) {
      buffer += chunk;
      let nl: number;
      while ((nl = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, nl);
        buffer = buffer.slice(nl + 1);
        consume(line);
      }
    },
    flush() { const rest = buffer; buffer = ''; consume(rest); },
  };
}

export interface SpawnConfig {
  cwd: string;
  sessionId?: string;
  prompt?: string;
  systemPrompt?: string;
  model?: string;
  effort?: string;
  permissionMode?: PermissionMode;
  jsonSchema?: unknown;
  maxBudgetUsd?: number;
  allowedTools?: string[];
  disallowedTools?: string[];
  addDirs?: string[];
  settingsFile?: string;
  resumeSessionId?: string;
  env?: Record<string, string>;
}

export interface SessionHandle {
  sessionId: string;
  child: ChildProcess;
  send(text: string): void;
  interrupt(): Promise<'stopped' | 'killed'>;
  close(): void;
  kill(): void;
  firstResult: Promise<ClaudeEvent>;
  exited: Promise<number | null>;
  totalCostUsd(): number;
}

export interface SessionCallbacks {
  onEvent?: (rec: ClaudeEvent) => void;
  onTextDelta?: (text: string) => void;
  onAssistantText?: (text: string) => void;
  onThinkingDelta?: (text: string) => void;
  onToolUse?: (call: { id: string; name: string; input: unknown }) => void;
  onToolResult?: (res: { id: string; content: string; isError: boolean }) => void;
  onResult?: (rec: ClaudeEvent) => void;
  onRateLimit?: (info: RateLimitInfo) => void;
  onUsage?: (used: number, limit: number) => void;
  onInit?: (rec: ClaudeEvent) => void;
  onStderr?: (chunk: string) => void;
  onExit?: (code: number | null) => void;
}

export function buildArgs(cfg: SpawnConfig, sessionId: string): string[] {
  const args = [
    '-p',
    '--input-format', 'stream-json',
    '--output-format', 'stream-json',
    '--include-partial-messages',
    '--forward-subagent-text',
    '--verbose',
  ];
  if (cfg.resumeSessionId) args.push('--resume', cfg.resumeSessionId);
  else args.push('--session-id', sessionId);
  if (cfg.systemPrompt) args.push('--append-system-prompt', cfg.systemPrompt);
  if (cfg.permissionMode) args.push('--permission-mode', cfg.permissionMode);
  if (cfg.model) args.push('--model', cfg.model);
  if (cfg.effort) args.push('--effort', cfg.effort);
  if (cfg.jsonSchema) args.push('--json-schema', JSON.stringify(cfg.jsonSchema));
  if (cfg.maxBudgetUsd != null) args.push('--max-budget-usd', String(cfg.maxBudgetUsd));
  if (cfg.allowedTools?.length) args.push('--allowed-tools', ...cfg.allowedTools);
  if (cfg.disallowedTools?.length) args.push('--disallowed-tools', ...cfg.disallowedTools);
  if (cfg.settingsFile) args.push('--settings', cfg.settingsFile);
  for (const dir of cfg.addDirs ?? []) args.push('--add-dir', dir);
  return args;
}

/**
 * The settings file carrying our hooks. PreToolUse is the gate: the daemon
 * answers it over loopback with the per-boot token, and refuses the handful
 * of things a session must never do to the machine it is on.
 */
export function writeHookSettings(port: number, token: string): string {
  const dir = join(superbuildsHome(), 'hooks');
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const file = join(dir, `settings-${port}.json`);
  const hook = (path: string, timeout = 30) => ({
    type: 'http',
    url: `http://127.0.0.1:${port}/hooks/${path}`,
    timeout,
    headers: { 'x-superbuilds-token': token },
  });
  const on = (path: string, timeout?: number) => [{ matcher: '*', hooks: [hook(path, timeout)] }];
  writeFileSync(file, JSON.stringify({
    hooks: {
      PreToolUse: on('pretooluse', 60),
      Notification: on('notification'),
    },
  }, null, 2), { mode: 0o600 });
  return file;
}

export function startSession(cfg: SpawnConfig, cb: SessionCallbacks = {}): SessionHandle {
  const sessionId = cfg.sessionId ?? randomUUID();
  const args = buildArgs(cfg, sessionId);

  // The user's environment, inherited untouched. No auth variable is ever injected.
  const child = spawnBin(resolveClaudeBin(), args, {
    cwd: cfg.cwd,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: cfg.env ? { ...process.env, ...cfg.env } : process.env,
  });

  let costTotal = 0;
  let firstResultSeen = false;
  let resolveFirst!: (v: ClaudeEvent) => void;
  let rejectFirst!: (e: Error) => void;
  const firstResult = new Promise<ClaudeEvent>((res, rej) => { resolveFirst = res; rejectFirst = rej; });
  let resolveExit!: (v: number | null) => void;
  const exited = new Promise<number | null>((res) => { resolveExit = res; });
  let stderr = '';
  const controlWaiters = new Map<string, () => void>();

  const parser = createNdjsonParser((rec) => {
    cb.onEvent?.(rec);
    if (rec.type === 'system' && rec.subtype === 'init') { cb.onInit?.(rec); return; }
    if (rec.type === 'rate_limit_event') { cb.onRateLimit?.(rec.rate_limit_info as RateLimitInfo); return; }
    if (rec.type === 'control_response') {
      const res = rec.response as { request_id?: string } | undefined;
      const id = String(res?.request_id ?? rec.request_id ?? '');
      controlWaiters.get(id)?.();
      controlWaiters.delete(id);
      return;
    }
    if (rec.type === 'stream_event') {
      const ev = rec.event as { type?: string; delta?: { text?: string; thinking?: string } } | undefined;
      if (ev?.type === 'content_block_delta') {
        if (ev.delta?.text) cb.onTextDelta?.(ev.delta.text);
        else if (ev.delta?.thinking) cb.onThinkingDelta?.(ev.delta.thinking);
      }
      return;
    }
    if (rec.type === 'assistant') {
      const content = (rec.message as { content?: unknown[] } | undefined)?.content ?? [];
      for (const block of content as Array<Record<string, unknown>>) {
        if (block.type === 'text' && typeof block.text === 'string') cb.onAssistantText?.(block.text);
        else if (block.type === 'tool_use') cb.onToolUse?.({ id: String(block.id), name: String(block.name), input: block.input });
      }
      return;
    }
    if (rec.type === 'user') {
      const content = (rec.message as { content?: unknown[] } | undefined)?.content ?? [];
      for (const block of content as Array<Record<string, unknown>>) {
        if (block.type === 'tool_result') {
          const raw = block.content;
          const text = typeof raw === 'string' ? raw
            : Array.isArray(raw) ? raw.map((b) => (b as { text?: string }).text ?? '').join('')
              : JSON.stringify(raw ?? '');
          cb.onToolResult?.({ id: String(block.tool_use_id), content: text, isError: block.is_error === true });
        }
      }
      return;
    }
    if (rec.type === 'result') {
      costTotal += Number(rec.total_cost_usd ?? 0);
      const usage = rec.usage as Record<string, number> | undefined;
      if (usage) {
        const used = (usage.input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0);
        if (used > 0) cb.onUsage?.(used, Number(rec.context_limit ?? 200_000));
      }
      cb.onResult?.(rec);
      if (!firstResultSeen) { firstResultSeen = true; resolveFirst(rec); }
    }
  }, () => { /* malformed lines are non-fatal */ });

  child.stdout?.setEncoding('utf8');
  child.stdout?.on('data', (c: string) => parser.push(c));
  child.stderr?.setEncoding('utf8');
  child.stderr?.on('data', (c: string) => { stderr += c; cb.onStderr?.(c); });
  child.on('error', (err) => { if (!firstResultSeen) rejectFirst(err); });
  /*
    The pipes need their own error handlers. Writing to the stdin of a process
    that has just exited raises `error` on the STREAM, and an unhandled stream
    error ends the daemon. Observed in PowerHouz: a late write after an
    interrupt took the whole application down mid-run.
  */
  child.stdin?.on('error', () => {});
  child.stdout?.on('error', () => {});
  child.stderr?.on('error', () => {});
  child.on('close', (code) => {
    parser.flush();
    if (!firstResultSeen) rejectFirst(new Error(`claude exited ${code} before producing a result.\n${stderr.slice(0, 1500)}`));
    cb.onExit?.(code);
    resolveExit(code);
  });

  const send = (text: string) => {
    if (!child.stdin?.writable) return;
    try {
      child.stdin.write(JSON.stringify({ type: 'user', message: { role: 'user', content: [{ type: 'text', text }] } }) + '\n');
    } catch { /* gone */ }
  };

  const interrupt = (): Promise<'stopped' | 'killed'> => {
    if (!child.stdin?.writable || child.exitCode !== null) { child.kill(); return Promise.resolve('killed'); }
    const requestId = `sb-interrupt-${randomUUID()}`;
    return new Promise((resolve) => {
      const fallback = setTimeout(() => {
        controlWaiters.delete(requestId);
        try { child.stdin?.end(); } catch {}
        try { child.kill(); } catch {}
        resolve('killed');
      }, 5_000);
      controlWaiters.set(requestId, () => { clearTimeout(fallback); resolve('stopped'); });
      try {
        child.stdin!.write(JSON.stringify({ type: 'control_request', request_id: requestId, request: { subtype: 'interrupt' } }) + '\n');
      } catch {
        clearTimeout(fallback); controlWaiters.delete(requestId); child.kill(); resolve('killed');
      }
    });
  };

  if (cfg.prompt) send(cfg.prompt);

  return {
    sessionId, child, send, interrupt,
    close: () => { try { child.stdin?.end(); } catch {} },
    kill: () => { try { child.stdin?.end(); } catch {} try { child.kill(); } catch {} },
    firstResult, exited,
    totalCostUsd: () => costTotal,
  };
}

/** A turn can fail without the process failing. Every consumer must check. */
export function resultError(rec: ClaudeEvent): string | null {
  const failed = rec.is_error === true || String(rec.subtype ?? '').startsWith('error');
  if (!failed) return null;
  const errors = rec.errors;
  if (Array.isArray(errors) && errors.length) return errors.map(String).join('; ');
  const text = typeof rec.result === 'string' ? rec.result.trim() : '';
  if (text) return text;
  const terminal = rec.terminal_reason ? String(rec.terminal_reason) : '';
  if (terminal) return terminal;
  const subtype = String(rec.subtype ?? '');
  return subtype && subtype !== 'success' ? subtype : 'The turn failed for an unknown reason';
}

/** Structured output from a result record, tolerating both shapes. */
export function extractStructured(rec: ClaudeEvent): unknown {
  if (rec.structured_output !== undefined) return rec.structured_output;
  const text = rec.result;
  if (typeof text === 'string') { try { return JSON.parse(text); } catch {} }
  return undefined;
}

/**
 * One bounded, non-conversational ask: a prompt, a schema, an answer.
 * Used for clarifying questions, reference DNA and name suggestions. Read-only
 * tools, a small budget, and an exception on failure so callers decide.
 */
export async function askOnce<T>(opts: {
  cwd: string; prompt: string; schema: unknown; model?: string; maxBudgetUsd?: number;
  allowedTools?: string[]; systemPrompt?: string; timeoutMs?: number;
}): Promise<T> {
  const handle = startSession({
    cwd: opts.cwd,
    prompt: opts.prompt,
    jsonSchema: opts.schema,
    model: opts.model ?? 'sonnet',
    maxBudgetUsd: opts.maxBudgetUsd ?? 0.6,
    permissionMode: 'default',
    allowedTools: opts.allowedTools ?? ['Read', 'Glob', 'Grep'],
    systemPrompt: opts.systemPrompt,
  });
  const timer = setTimeout(() => handle.kill(), opts.timeoutMs ?? 180_000);
  try {
    const rec = await handle.firstResult;
    const err = resultError(rec);
    if (err) throw new Error(err);
    const out = extractStructured(rec);
    if (out === undefined) throw new Error('No structured answer came back.');
    return out as T;
  } finally {
    clearTimeout(timer);
    handle.close();
    setTimeout(() => handle.kill(), 2_000).unref();
  }
}

/** Which models this Claude Code install accepts, read from its own help text. */
let modelCache: string[] | null = null;
export async function listModels(): Promise<string[]> {
  if (modelCache) return modelCache;
  const known = ['fable', 'opus', 'sonnet', 'haiku'];
  try {
    const { stdout } = await promisify(execFile)(resolveClaudeBin(), ['--help'], { timeout: 20_000, windowsHide: true, maxBuffer: 4e6 });
    const section = stdout.match(/--model[\s\S]{0,600}/)?.[0] ?? '';
    const quoted = [...section.matchAll(/'([a-z][a-z0-9.-]{2,40})'/g)].map((m) => m[1]).filter((n) => !n.startsWith('claude-'));
    const found = [...new Set([...quoted, ...known])];
    modelCache = [...known.filter((k) => found.includes(k)), ...found.filter((f) => !known.includes(f))];
  } catch { modelCache = known; }
  return modelCache;
}
