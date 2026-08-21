/**
 * Putting a folder back the way it was before a message.
 *
 * Ported from PowerHouz. A checkpoint is a copy of exactly the files that were
 * already different from HEAD plus a record of what was there. Rewinding
 * restores tracked files to HEAD, deletes anything created since, then puts the
 * recorded copies back — so pre-existing uncommitted work survives, which is
 * the part a naive `git checkout .` would destroy.
 *
 * Generated sites are git repositories from the moment they are scaffolded and
 * every chat turn commits, so in practice HEAD is "before the last change" and
 * a checkpoint is mostly a safety net for the turn in flight.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const exec = promisify(execFile);
const MAX_FILE_BYTES = 4 * 1024 * 1024;
const MAX_FILES = 400;

export interface SnapshotManifest {
  at: number;
  head?: string;
  isGitRepo: boolean;
  files: Array<{ path: string; tracked: boolean; missing?: boolean }>;
  skipped: string[];
}

async function git(cwd: string, args: string[]): Promise<string | null> {
  try {
    const { stdout } = await exec('git', args, { cwd, timeout: 60_000, maxBuffer: 20e6, windowsHide: true });
    return stdout;
  } catch { return null; }
}

async function changedPaths(projectPath: string) {
  const out = await git(projectPath, ['status', '--porcelain', '-uall']);
  if (out === null) return null;
  const files: Array<{ path: string; tracked: boolean; missing: boolean }> = [];
  for (const raw of out.split('\n')) {
    if (!raw.trim()) continue;
    const code = raw.slice(0, 2);
    let path = raw.slice(3).trim();
    const arrow = path.indexOf(' -> ');
    if (arrow !== -1) path = path.slice(arrow + 4);
    path = path.replace(/^"|"$/g, '');
    if (!path) continue;
    files.push({ path, tracked: code !== '??', missing: code.includes('D') });
  }
  return files;
}

export async function takeSnapshot(projectPath: string, destDir: string): Promise<{ ok: boolean; fileCount: number; message?: string }> {
  const changed = await changedPaths(projectPath);
  const isGitRepo = changed !== null;
  const head = isGitRepo ? (await git(projectPath, ['rev-parse', 'HEAD']))?.trim() : undefined;
  const manifest: SnapshotManifest = { at: Date.now(), head, isGitRepo, files: [], skipped: [] };
  if (isGitRepo) {
    for (const entry of changed.slice(0, MAX_FILES)) {
      const source = join(projectPath, entry.path);
      if (entry.missing || !existsSync(source)) { manifest.files.push({ path: entry.path, tracked: entry.tracked, missing: true }); continue; }
      try {
        if (statSync(source).size > MAX_FILE_BYTES) { manifest.skipped.push(entry.path); continue; }
        const target = join(destDir, 'files', entry.path);
        mkdirSync(dirname(target), { recursive: true });
        copyFileSync(source, target);
        manifest.files.push({ path: entry.path, tracked: entry.tracked });
      } catch { manifest.skipped.push(entry.path); }
    }
    if (changed.length > MAX_FILES) manifest.skipped.push(`… and ${changed.length - MAX_FILES} more`);
  }
  mkdirSync(destDir, { recursive: true });
  writeFileSync(join(destDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  return { ok: true, fileCount: manifest.files.length, message: isGitRepo ? undefined : 'Not a git repository, so nothing can be put back.' };
}

export async function restoreSnapshot(projectPath: string, snapDir: string): Promise<{ ok: boolean; message: string; restored: number }> {
  const file = join(snapDir, 'manifest.json');
  if (!existsSync(file)) return { ok: false, message: 'That checkpoint is no longer on disk.', restored: 0 };
  let manifest: SnapshotManifest;
  try { manifest = JSON.parse(readFileSync(file, 'utf8')) as SnapshotManifest; } catch { return { ok: false, message: 'That checkpoint could not be read.', restored: 0 }; }
  if (!manifest.isGitRepo) return { ok: false, message: 'This folder is not a git repository, so there is no safe way to put it back.', restored: 0 };

  const reset = await git(projectPath, ['checkout', '--', '.']);
  if (reset === null) return { ok: false, message: 'git could not restore the tracked files.', restored: 0 };

  const known = new Set(manifest.files.map((f) => f.path.replace(/\\/g, '/')));
  const nowUntracked = (await git(projectPath, ['ls-files', '--others', '--exclude-standard']))?.split('\n').map((s) => s.trim()).filter(Boolean) ?? [];
  const snapRoot = resolve(snapDir);
  let removed = 0;
  for (const path of nowUntracked) {
    if (known.has(path.replace(/\\/g, '/'))) continue;
    const full = resolve(projectPath, path);
    if (relative(projectPath, full).startsWith('..')) continue;
    if (full === snapRoot || !relative(snapRoot, full).startsWith('..')) continue;
    try { rmSync(full, { force: true }); removed++; } catch {}
  }
  let restored = 0;
  for (const entry of manifest.files) {
    const source = join(snapDir, 'files', entry.path);
    const target = resolve(projectPath, entry.path);
    if (relative(projectPath, target).startsWith('..')) continue;
    if (entry.missing) { try { rmSync(target, { force: true }); restored++; } catch {} continue; }
    if (!existsSync(source)) continue;
    try { mkdirSync(dirname(target), { recursive: true }); copyFileSync(source, target); restored++; } catch {}
  }
  const parts = [`${restored} file${restored === 1 ? '' : 's'} put back`];
  if (removed) parts.push(`${removed} created since then removed`);
  return { ok: true, message: parts.join(', ') + '.', restored };
}

export function pruneSnapshots(root: string, keep: number) {
  if (!existsSync(root)) return 0;
  let entries: string[];
  try { entries = readdirSync(root); } catch { return 0; }
  const dirs = entries.map((name) => ({ name, full: join(root, name) }))
    .filter((d) => { try { return statSync(d.full).isDirectory(); } catch { return false; } })
    .sort((a, b) => statSync(b.full).mtimeMs - statSync(a.full).mtimeMs);
  let dropped = 0;
  for (const dir of dirs.slice(keep)) { try { rmSync(dir.full, { recursive: true, force: true }); dropped++; } catch {} }
  return dropped;
}
