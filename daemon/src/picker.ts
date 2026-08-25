/**
 * Choosing a folder the way every other program on the machine lets you.
 *
 * ── Why a native dialog and not a file input ────────────────────────────────
 *
 * The browser will happily give you `<input type="file" webkitdirectory>`, and
 * it is useless here: for privacy reasons it hands back relative paths and a
 * synthetic root name, never `D:\Developer\the-restaurant`. But the thing that
 * needs the answer is not the browser, it is this daemon — a program running
 * on the person's own machine with their own permissions. So it asks the
 * operating system to show its own folder picker, and gets a real absolute
 * path back. Typing the path by hand still works and always will; it is just
 * no longer the only way.
 *
 * ── And why there is a second way in ────────────────────────────────────────
 *
 * A native dialog can fail for reasons nobody can act on: no desktop session,
 * a headless container, PowerShell locked down by policy, no zenity installed.
 * When it does, `browse` walks the filesystem inside the interface instead —
 * the same answer, three more presses. Neither path is allowed to be the only
 * one.
 *
 * ── What is exposed ─────────────────────────────────────────────────────────
 *
 * Directory *names*, to a caller that already holds this boot's token on a
 * socket bound to 127.0.0.1. No file is opened and no content is read: the
 * only thing read besides the names is whether a `package.json` or an
 * `index.html` sits in a folder, which is what makes the list useful rather
 * than a wall of identical rows. Dot-folders and the heavy build directories
 * are left out because nobody is looking for them and they make the list
 * unreadable.
 */

import { execFile } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { basename, dirname, join, resolve, sep } from 'node:path';

export interface Entry {
  name: string;
  path: string;
  /** A folder that looks like it holds a website — shown first, and marked. */
  site?: boolean;
}

export interface Listing {
  ok: boolean;
  path: string;
  /** The parent, or undefined at a root. */
  up?: string;
  entries: Entry[];
  /** Home, Desktop, Documents, Downloads, and on Windows every drive. */
  places: Entry[];
  reason?: string;
  truncated?: boolean;
}

const SKIP = new Set(['node_modules', '.git', '.next', 'dist', 'build', 'out', '.cache', '.turbo', 'vendor', '__pycache__', '.venv', 'venv', 'Library', 'AppData']);
const MAX_ENTRIES = 400;

function isSite(dir: string): boolean {
  try { return existsSync(join(dir, 'package.json')) || existsSync(join(dir, 'index.html')); } catch { return false; }
}

/** Somewhere sensible to start, and the roots people actually keep code in. */
export function places(): Entry[] {
  const home = homedir();
  const out: Entry[] = [];
  const add = (p: string, name?: string) => {
    try { if (existsSync(p) && statSync(p).isDirectory()) out.push({ name: name ?? (basename(p) || p), path: p }); } catch { /* unreadable */ }
  };
  add(home, 'Home');
  for (const d of ['Desktop', 'Documents', 'Downloads', 'Projects', 'code', 'Code', 'dev', 'Developer', 'src', 'repos', 'GitHub']) add(join(home, d));

  if (platform() === 'win32') {
    // Every drive that answers, so a project on D: is one press away.
    for (const letter of 'CDEFGHIJKLMNOPQRSTUVWXYZ') {
      const root = `${letter}:${sep}`;
      try { if (existsSync(root)) out.push({ name: `${letter}:`, path: root }); } catch { /* not mounted */ }
    }
  }
  // The same path listed twice looks like a bug even when it is a coincidence.
  const seen = new Set<string>();
  return out.filter((e) => (seen.has(e.path) ? false : (seen.add(e.path), true)));
}

/** One directory's sub-directories, sites first. Never reads a file. */
export function browse(path?: string): Listing {
  const start = (path ?? '').trim();
  const dir = start ? resolve(start) : homedir();
  const base: Listing = { ok: true, path: dir, entries: [], places: places() };

  let stat;
  try { stat = statSync(dir); } catch {
    return { ...base, ok: false, path: dir, reason: 'There is nothing at that path.' };
  }
  if (!stat.isDirectory()) return { ...base, ok: false, reason: 'That is a file, not a folder.' };

  const up = dirname(dir);
  base.up = up === dir ? undefined : up;

  let names: string[];
  try { names = readdirSync(dir); } catch (e) {
    return { ...base, ok: false, reason: `That folder cannot be read (${(e as Error).message}).` };
  }

  const entries: Entry[] = [];
  for (const name of names) {
    if (entries.length >= MAX_ENTRIES) { base.truncated = true; break; }
    if (name.startsWith('.') || SKIP.has(name)) continue;
    const full = join(dir, name);
    try { if (!statSync(full).isDirectory()) continue; } catch { continue; }
    entries.push({ name, path: full, site: isSite(full) || undefined });
  }
  entries.sort((a, b) => (a.site === b.site ? a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }) : a.site ? -1 : 1));
  base.entries = entries;
  return base;
}

/**
 * The operating system's own folder picker.
 *
 * Each platform gets the thing its users already recognise. The dialog is
 * modal to *their* desktop, not to this process, so the wait is capped: a
 * picker somebody walked away from must not hold a request open forever.
 */
export function pickFolder(start?: string): Promise<{ ok: boolean; path?: string; reason?: string }> {
  const from = start && existsSync(start) ? resolve(start) : homedir();
  const os = platform();

  if (os === 'win32') {
    // -STA because FolderBrowserDialog is a WinForms control and WinForms is
    // single-threaded-apartment only; without it the call returns nothing at
    // all. The dialog opens on MyComputer, so every drive stays reachable.
    const ps = [
      'Add-Type -AssemblyName System.Windows.Forms | Out-Null;',
      '$d = New-Object System.Windows.Forms.FolderBrowserDialog;',
      '$d.Description = "Choose the folder your website lives in";',
      '$d.ShowNewFolderButton = $false;',
      `$d.SelectedPath = ${quotePs(from)};`,
      'if ($d.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::Out.Write($d.SelectedPath) }',
    ].join(' ');
    return run('powershell.exe', ['-NoProfile', '-NonInteractive', '-STA', '-Command', ps]);
  }

  if (os === 'darwin') {
    const script = `POSIX path of (choose folder with prompt "Choose the folder your website lives in" default location POSIX file ${JSON.stringify(from)})`;
    return run('osascript', ['-e', script]);
  }

  // Linux and the rest: whichever of the two desktop dialogs is installed.
  return run('zenity', ['--file-selection', '--directory', '--title=Choose the folder your website lives in', `--filename=${from}${sep}`])
    .then((r) => (r.ok || r.reason !== 'missing' ? r : run('kdialog', ['--getexistingdirectory', from])))
    .then((r) => (r.reason === 'missing' ? { ok: false, reason: 'This desktop has no folder picker installed (zenity or kdialog). Type or paste the path instead.' } : r));
}

/** A PowerShell literal: the only escape inside single quotes is a doubled quote. */
function quotePs(s: string): string {
  return `'${s.split("'").join("''")}'`;
}

function run(cmd: string, args: string[]): Promise<{ ok: boolean; path?: string; reason?: string }> {
  return new Promise((done) => {
    let settled = false;
    const finish = (r: { ok: boolean; path?: string; reason?: string }) => { if (!settled) { settled = true; done(r); } };

    const child = execFile(cmd, args, { windowsHide: true, maxBuffer: 1 << 20 }, (err, stdout) => {
      const picked = String(stdout ?? '').trim();
      if (picked) {
        // Trust the operating system, but read the folder back before handing
        // the path to anything that will act on it.
        try { if (statSync(picked).isDirectory()) return finish({ ok: true, path: resolve(picked) }); } catch { /* gone already */ }
        return finish({ ok: false, reason: 'That folder could not be read back.' });
      }
      if (err && (err as NodeJS.ErrnoException).code === 'ENOENT') return finish({ ok: false, reason: 'missing' });
      // No path and no error is the ordinary case: they pressed Cancel.
      finish({ ok: false, reason: 'cancelled' });
    });

    const timer = setTimeout(() => {
      try { child.kill(); } catch { /* already gone */ }
      finish({ ok: false, reason: 'The picker was open for three minutes with no answer, so it was closed.' });
    }, 180_000);
    child.on('close', () => clearTimeout(timer));
  });
}
