/**
 * Finding and running CLIs that Windows installed as scripts.
 *
 * Ported from PowerHouz, where this file exists because of one invisible bug:
 * `spawn('vercel')` never tries `vercel.cmd`, because PATHEXT is a convention
 * of the command processor, not the operating system — and since the fix for
 * CVE-2024-27980 Node refuses to launch a `.cmd` without a shell. So every npm
 * global on Windows looked uninstalled while sitting on PATH, working.
 */

import { spawn, execFile, type ChildProcess, type SpawnOptions } from 'node:child_process';
import { existsSync } from 'node:fs';
import { delimiter, extname, join } from 'node:path';

const SHIM_EXTENSIONS = new Set(['.cmd', '.bat']);

/** The real file behind a command name, doing what the shell would. Windows only. */
export function findOnPath(name: string): string | null {
  if (process.platform !== 'win32' || !name) return null;
  if (name.includes('/') || name.includes('\\')) return existsSync(name) ? name : null;
  const exts = (process.env.PATHEXT ?? '.COM;.EXE;.BAT;.CMD').split(';').map((e) => e.trim()).filter(Boolean);
  const dirs = (process.env.PATH ?? '').split(delimiter).filter(Boolean);
  const spellings = extname(name) ? [''] : exts;
  for (const dir of dirs) {
    for (const ext of spellings) {
      const candidate = join(dir.replace(/^"|"$/g, ''), name + ext);
      if (existsSync(candidate)) return candidate;
    }
  }
  return null;
}

/**
 * One argument, as the command processor will read it back. Double quotes stop
 * `&`, `|`, `>` being read as syntax; this is why the fix is not `shell: true`,
 * which concatenates arguments without escaping any of them.
 */
function cmdQuote(arg: string): string {
  if (arg === '') return '""';
  if (!/[\s"&|<>^()]/.test(arg)) return arg;
  return `"${arg.replace(/"/g, '""')}"`;
}

/** Spawn a command by name; on Windows, resolve shims and run them through cmd. */
export function spawnBin(name: string, args: string[], opts: SpawnOptions = {}): ChildProcess {
  const resolved = findOnPath(name) ?? name;
  if (process.platform === 'win32' && SHIM_EXTENSIONS.has(extname(resolved).toLowerCase())) {
    const line = [cmdQuote(resolved), ...args.map(cmdQuote)].join(' ');
    return spawn('cmd.exe', ['/d', '/s', '/c', `"${line}"`], { ...opts, windowsVerbatimArguments: true, windowsHide: true });
  }
  return spawn(resolved, args, { ...opts, windowsHide: true });
}

/** Run to completion and report, never throw. Missing binaries are reported in `out`. */
export function execBin(name: string, args: string[], opts: { cwd?: string; timeout?: number; env?: NodeJS.ProcessEnv } = {}):
Promise<{ ok: boolean; out: string; code: number | null }> {
  return new Promise((resolve) => {
    let child: ChildProcess;
    try {
      child = spawnBin(name, args, { cwd: opts.cwd, env: opts.env ?? process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (err) {
      resolve({ ok: false, out: (err as Error).message, code: null });
      return;
    }
    let out = '';
    const timer = setTimeout(() => { try { child.kill(); } catch {} }, opts.timeout ?? 15_000);
    child.stdout?.setEncoding('utf8');
    child.stderr?.setEncoding('utf8');
    child.stdout?.on('data', (c: string) => { out += c; });
    child.stderr?.on('data', (c: string) => { out += c; });
    child.on('error', (err) => { clearTimeout(timer); resolve({ ok: false, out: `${out}\n${err.message}`.trim(), code: null }); });
    child.on('close', (code) => { clearTimeout(timer); resolve({ ok: code === 0, out: out.trim(), code }); });
  });
}

/** For things that are plain executables and never shims (git, node). */
export async function execPlain(cmd: string, args: string[], timeout = 15_000): Promise<{ ok: boolean; out: string }> {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout, windowsHide: true, maxBuffer: 4e6 }, (err, stdout, stderr) => {
      const out = `${stdout ?? ''}${stderr ?? ''}`.trim();
      if (err) resolve({ ok: false, out: out || err.message });
      else resolve({ ok: true, out });
    });
  });
}
